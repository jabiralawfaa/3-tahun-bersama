/**
 * lib/lrc.ts
 * ------------------------------------------------------------------
 * Enhanced LRC parser.
 *
 * Mendukung:
 *  - Timestamp per baris  : [mm:ss.xx]
 *  - Timestamp per kata   : <mm:ss.xx>kata <mm:ss.xx>kata ...
 *
 * Menghasilkan struktur terurut dengan endTime per baris dihitung
 * otomatis dari awal baris berikutnya.
 * ------------------------------------------------------------------ */
import type { AnimationPreset } from "@/data/memories";
import type { LineConfig } from "@/data/memories";

export interface LrcWord {
  /** Waktu mulai kata dalam detik */
  time: number;
  /** Teks kata (bisa mengandung spasi) */
  text: string;
}

export interface ParsedLrcLine {
  /** Indeks baris (0-based) */
  index: number;
  /** Waktu mulai baris (detik) */
  time: number;
  /** Waktu akhir baris (detik) */
  endTime: number;
  /** Teks penuh baris (tanpa timestamp) */
  text: string;
  /** Daftar kata dengan timestamp per kata */
  words: LrcWord[];
  /** Preset animasi kinetic typography */
  animationPreset: AnimationPreset;
  /** Subteks refleksi pribadi */
  reflection: string;
}

/** Konversi "mm:ss.xx" atau "mm:ss" ke detik (number). */
function timeToSeconds(raw: string): number {
  const parts = raw.split(":");
  if (parts.length < 2) return parseFloat(raw) || 0;
  const minutes = parseInt(parts[0], 10) || 0;
  const seconds = parseFloat(parts[1]) || 0;
  return minutes * 60 + seconds;
}

const LINE_TIME_RE = /^\[(\d{1,2}:\d{1,2}(?:\.\d+)?)\]/;
const WORD_TIME_RE = /<(\d{1,2}:\d{1,2}(?:\.\d+)?)>([^<]*)/g;
const META_RE = /^\[(ti|ar|al|length|re|by|offset|au|ve|id):/i;

/**
 * Parse string Enhanced LRC menjadi daftar baris terstruktur.
 * Baris metadata seperti [ti:...], [length:...] diabaikan.
 */
export function parseEnhancedLrc(
  lrc: string,
  lineConfig: LineConfig[] = [],
): ParsedLrcLine[] {
  const rawLines = lrc.split(/\r?\n/);
  const parsed: Omit<ParsedLrcLine, "endTime" | "index">[] = [];

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;
    if (META_RE.test(line)) continue;

    const lineMatch = line.match(LINE_TIME_RE);
    if (!lineMatch) continue;

    const lineTime = timeToSeconds(lineMatch[1]);
    // Sisa konten setelah timestamp baris
    const content = line.slice(lineMatch[0].length);

    const words: LrcWord[] = [];
    let fullText = "";
    let m: RegExpExecArray | null;
    // reset lastIndex karena regex global dipakai berulang
    WORD_TIME_RE.lastIndex = 0;
    while ((m = WORD_TIME_RE.exec(content)) !== null) {
      const wTime = timeToSeconds(m[1]);
      const wText = m[2];
      words.push({ time: wTime, text: wText });
      fullText += wText;
    }

    // Fallback: jika tidak ada timestamp per kata, pakai seluruh teks
    if (words.length === 0) {
      const cleanText = content.replace(/<[^>]+>/g, "").trim();
      words.push({ time: lineTime, text: cleanText });
      fullText = cleanText;
    }

    parsed.push({
      time: lineTime,
      text: fullText.trim(),
      words,
      animationPreset: "blur-fade",
      reflection: "",
    });
  }

  parsed.sort((a, b) => a.time - b.time);

  // Hitung endTime dari baris berikutnya; baris terakhir diberi durasi 6s.
  const withEnd: ParsedLrcLine[] = parsed.map((line, i) => {
    const next = parsed[i + 1];
    const endTime = next ? next.time : line.time + 6;
    const cfg = lineConfig[i];
    return {
      index: i,
      time: line.time,
      endTime,
      text: line.text,
      words: line.words,
      animationPreset: cfg?.animationPreset ?? line.animationPreset,
      reflection: cfg?.reflection ?? line.reflection,
    };
  });

  return withEnd;
}

/**
 * Cari indeks baris yang sedang aktif pada waktu tertentu.
 * Mengembalikan -1 bila belum ada baris aktif.
 */
export function findActiveLineIndex(
  lines: ParsedLrcLine[],
  currentTime: number,
): number {
  // baris aktif = baris terakhir yang time <= currentTime DAN currentTime < endTime
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (currentTime >= l.time && currentTime < l.endTime) {
      return i;
    }
  }
  // Jika waktu berada sebelum baris pertama, tidak ada yang aktif.
  if (lines.length && currentTime < lines[0].time) return -1;
  // Jika waktu melewati baris terakhir, kembalikan indeks terakhir.
  if (lines.length && currentTime >= lines[lines.length - 1].endTime) {
    return lines.length - 1;
  }
  return -1;
}

/**
 * Bangun timeline untuk mode "plain" (ucapan biasa tanpa LRC).
 * Durasi lagu dibagi rata sesuai jumlah baris tulisan:
 * baris ke-i mulai pada i*seg, selesai pada (i+1)*seg,
 * di mana seg = duration / count.
 *
 * Setiap baris diperlakukan sebagai satu kesatuan (satu "kata" = seluruh
 * teks baris), karena tidak ada timestamp per kata.
 */
export function buildPlainTimeline(
  plainLines: string[],
  duration: number,
  lineConfig: { reflection?: string; animationPreset?: AnimationPreset }[] = [],
): ParsedLrcLine[] {
  const count = plainLines.length;
  if (count === 0 || duration <= 0) return [];
  const seg = duration / count;
  return plainLines.map((text, i) => {
    const cfg = lineConfig[i];
    return {
      index: i,
      time: i * seg,
      endTime: (i + 1) * seg,
      text,
      // Satu "kata" = seluruh teks baris (tidak ada highlight per kata).
      words: [{ time: i * seg, text }],
      animationPreset: cfg?.animationPreset ?? "blur-fade",
      reflection: cfg?.reflection ?? "",
    };
  });
}

/**
 * Cari indeks kata aktif dalam sebuah baris pada waktu tertentu.
 * Mengembalikan -1 bila belum ada kata aktif.
 */
export function findActiveWordIndex(
  line: ParsedLrcLine | undefined,
  currentTime: number,
): number {
  if (!line) return -1;
  for (let i = line.words.length - 1; i >= 0; i--) {
    if (currentTime >= line.words[i].time) return i;
  }
  return -1;
}

/** Format detik -> "m:ss" */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
