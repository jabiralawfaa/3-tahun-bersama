/**
 * /api/media/[id]  (admin)
 * - PUT    : ubah nama gambar  { name }
 * - DELETE : hapus gambar (ditolak bila masih dipakai entri)
 * ------------------------------------------------------------------ */
import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { cleanMediaName } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { name?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* kosong */
  }
  const name = cleanMediaName(typeof body.name === "string" ? body.name : "");
  if (!name) {
    return NextResponse.json({ error: "Nama tidak boleh kosong" }, { status: 400 });
  }
  const existing = await db.media.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Gambar tidak ditemukan" }, { status: 404 });
  }
  const row = await db.media.update({ where: { id }, data: { name } });
  return NextResponse.json({ media: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await db.media.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Gambar tidak ditemukan" }, { status: 404 });
  }

  // Tolak bila masih dipakai entri mana pun (agar halaman publik tak rusak).
  const rows = await db.memory.findMany({
    select: { name: true, lineConfig: true },
  });
  const users = rows
    .filter((r) => r.lineConfig.includes(existing.id) || r.lineConfig.includes(existing.url))
    .map((r) => r.name);
  if (users.length) {
    return NextResponse.json(
      {
        error: `Gambar masih dipakai oleh: ${users.join(", ")}. Lepas dulu dari refleksi barisnya.`,
        usedBy: users,
      },
      { status: 409 },
    );
  }

  try {
    await del(existing.url);
  } catch (e) {
    console.error("media blob delete", e); // tetap hapus baris DB
  }
  await db.media.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
