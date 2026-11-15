/**
 * /api/memories/[id]
 * - PUT    : update entri (admin) — multipart/form-data
 * - DELETE : hapus entri (admin)
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

async function saveAudioFile(file: File, slug: string): Promise<string> {
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const filename = `${slug}-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(AUDIO_DIR, filename), buf);
  return `/audio/${filename}`;
}

function fstr(form: FormData, key: string, fallback = ""): string {
  const v = form.get(key);
  return typeof v === "string" ? v : fallback;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await db.memory.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Entri tidak ditemukan" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const code = (fstr(form, "code").trim() || existing.code).toLowerCase();
  let slug = fstr(form, "slug").trim();
  slug = slug ? slugify(slug) : existing.slug;
  const name = fstr(form, "name").trim() || existing.name;
  const enhancedLrc = fstr(form, "enhancedLrc") || existing.enhancedLrc;
  const accent = fstr(form, "accent", existing.accent).trim();
  const accentSoft = fstr(form, "accentSoft", existing.accentSoft).trim();
  const background = fstr(form, "background", existing.background).trim();

  if (!enhancedLrc.trim()) {
    return NextResponse.json(
      { error: "LRC wajib diisi" },
      { status: 400 },
    );
  }
  if (!isValidHex(accent) || !isValidHex(accentSoft) || !isValidHex(background)) {
    return NextResponse.json(
      { error: "Warna aksen harus hex valid (mis. #e8a23d)" },
      { status: 400 },
    );
  }

  // Uniqueness check (kecuali entri sendiri).
  const conflict = await db.memory.findFirst({
    where: {
      AND: [{ id: { not: id } }, { OR: [{ code }, { slug }] }],
    },
  });
  if (conflict) {
    return NextResponse.json(
      { error: `code/slug "${code}" sudah dipakai entri lain.` },
      { status: 409 },
    );
  }

  // Audio file opsional saat update.
  let audioSrc = fstr(form, "audioSrc", existing.audioSrc);
  const audioFile = form.get("audioFile");
  if (audioFile instanceof File && audioFile.size > 0) {
    audioSrc = await saveAudioFile(audioFile, slug);
  }

  const lineConfigRaw = fstr(form, "lineConfig");
  let lineConfig: LineConfig[] = JSON.parse(existing.lineConfig || "[]");
  if (lineConfigRaw) {
    try {
      const parsed = JSON.parse(lineConfigRaw);
      if (Array.isArray(parsed)) lineConfig = parsed as LineConfig[];
    } catch {
      return NextResponse.json(
        { error: "lineConfig bukan JSON valid" },
        { status: 400 },
      );
    }
  }

  const updated = await db.memory.update({
    where: { id },
    data: {
      code,
      slug,
      name,
      role: fstr(form, "role", existing.role),
      themeLabel: fstr(form, "themeLabel", existing.themeLabel),
      accent,
      accentSoft,
      background,
      decoration: fstr(form, "decoration", existing.decoration),
      audioSrc,
      songTitle: fstr(form, "songTitle", existing.songTitle),
      songArtist: fstr(form, "songArtist", existing.songArtist),
      enhancedLrc,
      lineConfig: JSON.stringify(lineConfig),
      finalMessage: fstr(form, "finalMessage", existing.finalMessage),
      finalFrameLabel: fstr(form, "finalFrameLabel", existing.finalFrameLabel),
    },
  });

  return NextResponse.json({ memory: memoryFromDb(updated) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await db.memory.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Entri tidak ditemukan" }, { status: 404 });
  }
  // Hapus file audio terkait (best-effort).
  if (existing.audioSrc?.startsWith("/audio/")) {
    try {
      await fs.unlink(path.join(process.cwd(), "public", existing.audioSrc));
    } catch {
      /* ignore */
    }
  }
  await db.memory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
