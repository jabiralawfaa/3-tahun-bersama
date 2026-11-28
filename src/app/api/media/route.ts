/**
 * /api/media  (admin — dijaga middleware)
 * - GET  : daftar gambar di pustaka Media
 * - POST : unggah SATU gambar (multipart: file, name). Klien mengunggah
 *          berurutan agar tiap request di bawah batas body Vercel.
 * ------------------------------------------------------------------ */
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { MEDIA_EXT, MEDIA_MAX_BYTES, cleanMediaName } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.media.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ media: rows });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Form tidak valid" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File gambar wajib diisi" }, { status: 400 });
  }
  const ext = MEDIA_EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Format harus PNG, JPG, WebP, GIF, atau AVIF" },
      { status: 400 },
    );
  }
  if (file.size > MEDIA_MAX_BYTES) {
    return NextResponse.json(
      { error: "Gambar terlalu besar (maks 4 MB)" },
      { status: 413 },
    );
  }
  const rawName = form.get("name");
  const name =
    cleanMediaName(typeof rawName === "string" ? rawName : "") ||
    cleanMediaName(file.name.replace(/\.[^.]+$/, "")) ||
    "gambar";

  const num = (k: string) => {
    const v = Number(form.get(k));
    return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
  };

  try {
    const blob = await put(`media/${Date.now()}.${ext}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    const row = await db.media.create({
      data: {
        name,
        url: blob.url,
        mime: file.type,
        size: file.size,
        width: num("width"),
        height: num("height"),
      },
    });
    return NextResponse.json({ media: row }, { status: 201 });
  } catch (e) {
    console.error("media upload", e);
    return NextResponse.json({ error: "Gagal mengunggah gambar" }, { status: 500 });
  }
}
