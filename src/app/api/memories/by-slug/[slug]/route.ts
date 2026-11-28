/**
 * /api/memories/by-slug/[slug]  (GET, publik)
 * ------------------------------------------------------------------
 * Dipakai halaman personal /for/[slug] untuk mengambil data satu entri.
 * Tidak butuh login.
 * ------------------------------------------------------------------ */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memoryFromDb, getMode } from "@/data/memories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const row = await db.memory.findUnique({ where: { slug } });
  if (!row) {
    return NextResponse.json(
      { error: "Arsip tidak ditemukan" },
      { status: 404 },
    );
  }
  const memory = memoryFromDb(row);

  // Mode ramai memakai foto acak dari pustaka Media. Daftar URL hanya
  // dikirim bila arsip ini memang memakai mode ramai (hemat payload dan
  // tidak membocorkan pustaka ke arsip yang tidak membutuhkannya).
  const usesCrowd =
    (getMode(memory) === "plain" && memory.iconLayout === "crowd") ||
    memory.lineConfig.some((c) => c.crowd === true);
  let crowdPhotos: string[] = [];
  if (usesCrowd) {
    const media = await db.media.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { url: true, width: true, height: true, size: true },
    });
    // Buang placeholder/ikon mungil yang tidak layak tampil besar-besar
    // di mode ramai (mis. gambar uji 1×1 byte kecil).
    crowdPhotos = media
      .filter(
        (m) =>
          m.size >= 2048 &&
          !(m.width > 0 && m.height > 0 && Math.min(m.width, m.height) < 64),
      )
      .map((m) => m.url);
  }

  return NextResponse.json({ memory, crowdPhotos });
}
