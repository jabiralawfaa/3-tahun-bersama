/**
 * /api/memories
 * - GET  : daftar semua entri (admin)
 * - POST : buat entri baru (admin) — multipart/form-data (audio file opsional)
 * ------------------------------------------------------------------ */
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { memoryFromDb, type LineConfig } from "@/data/memories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIO_DIR = path.join(process.cwd(), "public", "audio");

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

async function saveAudioFile(
  file: File,
  slug: string,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const filename = `${slug}-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(AUDIO_DIR, filename), buf);
  return `/audio/${filename}`;
}

/** Ambil field string dari FormData. */
function fstr(form: FormData, key: string, fallback = ""): string {
  const v = form.get(key);
  return typeof v === "string" ? v : fallback;
}

export async function GET() {
  const rows = await db.memory.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ memories: rows.map(memoryFromDb) });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const code = fstr(form, "code").trim().toLowerCase();
  const slugRaw = fstr(form, "slug").trim();
  const slug = slugRaw ? slugify(slugRaw) : slugify(code);
  const name = fstr(form, "name").trim();
  const enhancedLrc = fstr(form, "enhancedLrc");
  const accent = fstr(form, "accent", "#e8a23d").trim();
  const accentSoft = fstr(form, "accentSoft", "#d96a4f").trim();
  const background = fstr(form, "background", "#13131f").trim();

  // Mode: "lrc" (enhancedLrc terisi) ATAU "plain" (plainLines terisi).
  // Salah satu wajib ada.
  let plainLines: string[] = [];
  try {
    const parsed = JSON.parse(fstr(form, "plainLines", "[]"));
    if (Array.isArray(parsed))
      plainLines = parsed.filter((s) => typeof s === "string");
  } catch {
    plainLines = [];
  }
  const hasLrc = enhancedLrc.trim().length > 0;
  const hasPlain = plainLines.length > 0;

  if (!code || !slug || !name) {
    return NextResponse.json(
      { error: "code, slug, dan name wajib diisi" },
      { status: 400 },
    );
  }
  if (!hasLrc && !hasPlain) {
    return NextResponse.json(
      { error: "LRC atau tulisan per baris (plain) wajib diisi" },
      { status: 400 },
    );
  }
  if (!isValidHex(accent) || !isValidHex(accentSoft) || !isValidHex(background)) {
    return NextResponse.json(
      { error: "Warna aksen harus hex valid (mis. #e8a23d)" },
      { status: 400 },
    );
  }

  // Uniqueness check (DB juga enforce @unique, tapi pesan lebih ramah).
  const conflict = await db.memory.findFirst({
    where: { OR: [{ code }, { slug }] },
  });
  if (conflict) {
    return NextResponse.json(
      { error: `code/slug "${code}" sudah dipakai entri lain.` },
      { status: 409 },
    );
  }

  // Audio file (opsional saat create, tapi sebaiknya wajib).
  const audioFile = form.get("audioFile");
  let audioSrc = fstr(form, "audioSrc");
  if (audioFile instanceof File) {
    const saved = await saveAudioFile(audioFile, slug);
    if (saved) audioSrc = saved;
  }
  if (!audioSrc) {
    return NextResponse.json(
      { error: "File audio MP3 wajib diupload" },
      { status: 400 },
    );
  }

  // lineConfig JSON
  const lineConfigRaw = fstr(form, "lineConfig", "[]");
  let lineConfig: LineConfig[] = [];
  try {
    const parsed = JSON.parse(lineConfigRaw);
    if (Array.isArray(parsed)) lineConfig = parsed as LineConfig[];
  } catch {
    return NextResponse.json(
      { error: "lineConfig bukan JSON valid" },
      { status: 400 },
    );
  }

  const created = await db.memory.create({
    data: {
      code,
      slug,
      name,
      role: fstr(form, "role", "Teman Kelas"),
      themeLabel: fstr(form, "themeLabel", "Interactive Design Canvas & Editorial Motion"),
      accent,
      accentSoft,
      background,
      decoration: fstr(form, "decoration", "bezier"),
      audioSrc,
      songTitle: fstr(form, "songTitle", name),
      songArtist: fstr(form, "songArtist", "Tidak diketahui"),
      enhancedLrc,
      plainLines: JSON.stringify(plainLines),
      lineConfig: JSON.stringify(lineConfig),
      finalMessage: fstr(form, "finalMessage"),
      finalFrameLabel: fstr(form, "finalFrameLabel", "Final_Confession.tsx"),
    },
  });

  return NextResponse.json({ memory: memoryFromDb(created) }, { status: 201 });
}
