/**
 * lib/media.ts
 * ------------------------------------------------------------------
 * Pustaka gambar (menu Media): tipe, validasi, dan helper kompres di sisi
 * klien. Gambar disimpan di Vercel Blob; DB hanya menyimpan nama + URL.
 * ------------------------------------------------------------------ */
import type { LineConfig } from "@/data/memories";

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  createdAt?: string;
}

/** Format yang diterima server, sekaligus ekstensi berkasnya di Blob. */
export const MEDIA_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** Batas per file (body fungsi Vercel ±4,5 MB). */
export const MEDIA_MAX_BYTES = 4 * 1024 * 1024;
export const MEDIA_NAME_MAX = 60;

export function cleanMediaName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MEDIA_NAME_MAX);
}

/** Hanya URL https:// (Blob) atau path relatif yang boleh jadi sumber gambar. */
export function isSafeImageUrl(u: unknown): u is string {
  return typeof u === "string" && /^(https:\/\/|\/)[^\s"'<>]+$/.test(u) && !u.startsWith("//");
}

/** Bersihkan field gambar pada lineConfig yang datang dari klien. */
export function sanitizeLineConfig(input: LineConfig[]): LineConfig[] {
  return input.map((c) => {
    const next: LineConfig = { ...c };
    // Baris mode ramai (LRC) tidak boleh punya refleksi.
    if (next.crowd === true) next.reflection = "";
    else delete next.crowd;
    if (!isSafeImageUrl(next.imageUrl)) {
      delete next.imageUrl;
      delete next.imageId;
    } else if (typeof next.imageId !== "string") {
      delete next.imageId;
    }
    return next;
  });
}

/* ---------------- klien: kompres sebelum unggah ---------------- */

export interface PreparedImage {
  blob: Blob;
  mime: string;
  width: number;
  height: number;
  originalSize: number;
}

const MAX_SIDE = 1600;

/**
 * Perkecil gambar (sisi terpanjang ≤ 1600 px) dan ubah ke WebP agar ringan
 * di laptop/HP lama & muat di batas unggah. GIF dibiarkan (agar tetap animasi).
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) {
    throw new Error(
      `"${file.name}" tidak bisa dibaca sebagai gambar. Coba JPG, PNG, WebP, GIF, atau AVIF.`,
    );
  }
  const { width: w0, height: h0 } = bmp;

  // GIF dibiarkan apa adanya agar animasinya tidak hilang.
  if (file.type === "image/gif") {
    bmp.close();
    return { blob: file, mime: file.type, width: w0, height: h0, originalSize: file.size };
  }

  const k = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k));
  const h = Math.max(1, Math.round(h0 * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  const blob: Blob | null = ctx
    ? await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/webp", 0.86),
      ).catch(() => null)
    : null;

  // Hasil olahan klien selalu WebP, termasuk untuk foto ponsel (HEIC/HEIF)
  // atau berkas tanpa MIME yang tidak diterima server apa adanya.
  if (blob && blob.type === "image/webp") {
    return { blob, mime: "image/webp", width: w, height: h, originalSize: file.size };
  }
  // Canvas tidak bisa dipakai (jarang): kirim apa adanya bila formatnya sah.
  if (MEDIA_EXT[file.type]) {
    return { blob: file, mime: file.type, width: w0, height: h0, originalSize: file.size };
  }
  throw new Error(
    `Format "${file.type || "tidak dikenal"}" belum didukung. Simpan ulang sebagai JPG atau PNG lalu unggah lagi.`,
  );
}

export function formatKB(n: number): string {
  return n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;
}
