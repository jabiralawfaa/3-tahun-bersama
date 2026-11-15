/**
 * /api/validate-code  (POST, publik)
 * ------------------------------------------------------------------
 * Dipakai halaman gerbang / untuk memvalidasi kode nama.
 * Body JSON: { code }
 * Return { ok: true, slug } bila valid; { ok: false } bila tidak.
 *
 * Catatan: slug hanya dikembalikan jika kode cocok — tidak membocorkan
 * daftar slug yang ada.
 * ------------------------------------------------------------------ */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const code = (body.code ?? "").trim().toLowerCase();
  if (!code) return NextResponse.json({ ok: false });

  const row = await db.memory.findFirst({
    where: { code: { equals: code } },
    select: { slug: true },
  });
  if (!row) return NextResponse.json({ ok: false });
  return NextResponse.json({ ok: true, slug: row.slug });
}
