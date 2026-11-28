/**
 * /api/media/[id]  (admin)
 * - PUT    : ubah nama gambar  { name }
 * - DELETE : hapus gambar. Tanpa ?force=1 ditolak bila masih dipakai entri;
 *            dengan ?force=1 gambar dilepas dulu dari baris yang memakainya.
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
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await db.media.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Gambar tidak ditemukan" }, { status: 404 });
  }

  // Cari entri yang masih memakai gambar ini.
  const rows = await db.memory.findMany({
    select: { id: true, name: true, lineConfig: true },
  });
  const users = rows.filter(
    (r) => r.lineConfig.includes(existing.id) || r.lineConfig.includes(existing.url),
  );
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (users.length && !force) {
    return NextResponse.json(
      {
        error: `Gambar masih dipakai oleh: ${users.map((r) => r.name).join(", ")}. Hapus tetap akan melepasnya dari baris tersebut.`,
        usedBy: users.map((r) => r.name),
      },
      { status: 409 },
    );
  }

  // Hapus paksa: lepas referensi gambar dari lineConfig entri terkait agar
  // halaman publik tidak memuat URL yang sudah hilang.
  for (const row of users) {
    let config: unknown;
    try {
      config = JSON.parse(row.lineConfig);
    } catch {
      continue;
    }
    if (!Array.isArray(config)) continue;
    const next = config.map((c) => {
      if (!c || typeof c !== "object") return c;
      const line = { ...(c as Record<string, unknown>) };
      if (line.imageId === existing.id || line.imageUrl === existing.url) {
        delete line.imageId;
        delete line.imageUrl;
      }
      return line;
    });
    await db.memory.update({
      where: { id: row.id },
      data: { lineConfig: JSON.stringify(next) },
    });
  }

  try {
    await del(existing.url);
  } catch (e) {
    console.error("media blob delete", e); // tetap hapus baris DB
  }
  await db.media.delete({ where: { id } });
  return NextResponse.json({
    ok: true,
    detached: users.map((r) => r.name),
  });
}
