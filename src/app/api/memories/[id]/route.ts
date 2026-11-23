/**
 * /api/memories/[id]
 * - PUT    : update entri (admin) — multipart/form-data
 * - DELETE : hapus entri (admin)
 * ------------------------------------------------------------------ */
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import {
  memoryFromDb,
  normalizeIconLayout,
  type LineConfig,
} from "@/data/memories";
import { validateSvgIcons } from "@/lib/svg";

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
  const enhancedLrc = fstr(form, "enhancedLrc") ?? existing.enhancedLrc;
  const accent = fstr(form, "accent", existing.accent).trim();
  const accentSoft = fstr(form, "accentSoft", existing.accentSoft).trim();
  const background = fstr(form, "background", existing.background).trim();

  // Mode: "lrc" (enhancedLrc terisi) ATAU "plain" (plainLines terisi).
  let plainLines: string[] = [];
  const plainLinesRaw = fstr(form, "plainLines");
  if (plainLinesRaw) {
    try {
      const parsed = JSON.parse(plainLinesRaw);
      if (Array.isArray(parsed))
        plainLines = parsed.filter((s) => typeof s === "string");
    } catch {
      /* biarkan kosong */
    }
  } else {
    // Pertahankan plainLines yang ada jika tidak dikirim.
    try {
      const parsed = JSON.parse(existing.plainLines || "[]");
      if (Array.isArray(parsed))
        plainLines = parsed.filter((s) => typeof s === "string");
    } catch {
      plainLines = [];
    }
  }
  const hasLrc = enhancedLrc.trim().length > 0;
  const hasPlain = plainLines.length > 0;

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

  // Pustaka ikon SVG: hanya diganti bila dikirim; jika tidak, pertahankan.
  let svgIconsJson = (existing as { svgIcons?: string }).svgIcons ?? "[]";
  const svgIconsRaw = fstr(form, "svgIcons");
  if (svgIconsRaw) {
    let parsedIcons: unknown;
    try {
      parsedIcons = JSON.parse(svgIconsRaw);
    } catch {
      return NextResponse.json(
        { error: "svgIcons bukan JSON valid" },
        { status: 400 },
      );
    }
    const svgCheck = validateSvgIcons(parsedIcons);
    if (svgCheck.error) {
      return NextResponse.json({ error: svgCheck.error }, { status: 400 });
    }
    svgIconsJson = JSON.stringify(svgCheck.icons);
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
      plainLines: JSON.stringify(plainLines),
      lineConfig: JSON.stringify(lineConfig),
      svgIcons: svgIconsJson,
      iconLayout: normalizeIconLayout(
        fstr(
          form,
          "iconLayout",
          (existing as { iconLayout?: string }).iconLayout ?? "crowd",
        ),
      ),
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
