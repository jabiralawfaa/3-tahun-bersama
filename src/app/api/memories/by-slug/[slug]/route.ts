/**
 * /api/memories/by-slug/[slug]  (GET, publik)
 * ------------------------------------------------------------------
 * Dipakai halaman personal /for/[slug] untuk mengambil data satu entri.
 * Tidak butuh login.
 * ------------------------------------------------------------------ */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memoryFromDb } from "@/data/memories";

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
  return NextResponse.json({ memory: memoryFromDb(row) });
}
