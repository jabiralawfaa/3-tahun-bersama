/**
 * POST /api/admin/login
 * Body JSON: { username, password }
 * Set cookie HTTP-only "arsip_admin" bila valid.
 */
import { NextResponse } from "next/server";
import { checkCredentials, signToken, cookieOptions, ADMIN_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json(
      { error: "Username dan password wajib diisi" },
      { status: 400 },
    );
  }
  if (!checkCredentials(username, password)) {
    return NextResponse.json(
      { error: "Kredensial salah" },
      { status: 401 },
    );
  }
  const token = await signToken(username);
  const res = NextResponse.json({ ok: true, user: username });
  res.cookies.set(ADMIN_COOKIE, token, cookieOptions());
  return res;
}
