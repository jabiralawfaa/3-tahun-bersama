/**
 * lib/auth.ts
 * ------------------------------------------------------------------
 * Autentikasi admin sederhana berbasis cookie bertanda (HMAC-SHA256).
 * Memakai Web Crypto API (crypto.subtle) agar kompatibel dengan Edge
 * runtime (middleware) maupun Node runtime (route handlers).
 *
 * - Token = base64url(payload) + "." + base64url(HMAC-SHA256(payload))
 * - Payload: { user, exp } (exp = waktu kedaluwarsa, ms)
 * - Disimpan di cookie HTTP-only "arsip_admin".
 * ------------------------------------------------------------------ */

const COOKIE_NAME = "arsip_admin";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 hari

function getSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SECRET belum di-set di .env");
  }
  return secret;
}

/* ---------- base64url helpers (tanpa Buffer, Edge-safe) ---------- */
function b64urlEncodeBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlEncodeStr(str: string): string {
  return b64urlEncodeBytes(new TextEncoder().encode(str));
}

function b64urlDecodeToStr(str: string): string {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/* ---------- HMAC-SHA256 via Web Crypto ---------- */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return b64urlEncodeBytes(new Uint8Array(sig));
}

/** Bandingan string konstan-waktu (timing-safe). Edge-safe (tanpa node:crypto). */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------- Token API ---------- */

/** Buat token bertanda untuk user. */
export async function signToken(user: string): Promise<string> {
  const payload = JSON.stringify({ user, exp: Date.now() + TOKEN_TTL_MS });
  const body = b64urlEncodeStr(payload);
  const mac = await hmacSign(body, getSecret());
  return `${body}.${mac}`;
}

/** Verifikasi token. Return username bila valid & belum kedaluwarsa. */
export async function verifyToken(
  token: string | undefined | null,
): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, mac] = parts;
  // Verifikasi HMAC
  const expectedMac = await hmacSign(body, getSecret());
  if (!timingSafeEqualStr(mac, expectedMac)) return null;
  let payload: { user?: string; exp?: number };
  try {
    payload = JSON.parse(b64urlDecodeToStr(body));
  } catch {
    return null;
  }
  if (!payload.user || typeof payload.exp !== "number") return null;
  if (Date.now() > payload.exp) return null;
  return payload.user;
}

/** Validasi kredensial terhadap env. */
export function checkCredentials(
  username: string,
  password: string,
): boolean {
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return false;
  return timingSafeEqualStr(u, username) && timingSafeEqualStr(p, password);
}

export const ADMIN_COOKIE = COOKIE_NAME;
export const ADMIN_TOKEN_TTL = TOKEN_TTL_MS;

/** Opsi cookie standar. */
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: TOKEN_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Baca user dari cookie pada Request (server-side, async). */
export async function getUserFromRequest(
  req: Request,
): Promise<string | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const token = parseCookie(cookie, COOKIE_NAME);
  return verifyToken(token);
}

function parseCookie(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
