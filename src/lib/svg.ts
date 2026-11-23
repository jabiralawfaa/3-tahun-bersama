/**
 * lib/svg.ts
 * ------------------------------------------------------------------
 * Ikon SVG animasi untuk baris lirik.
 *
 * Keamanan: kode SVG dari dashboard TIDAK pernah dipasang lewat
 * dangerouslySetInnerHTML. Kode di-parse menjadi pohon sederhana
 * (hanya tag + atribut whitelist), lalu dirender ulang sebagai elemen
 * React. Script, event handler, <style>, <foreignObject>, <use>,
 * <image>, href, dsb. otomatis terbuang.
 *
 * Bentuk yang didukung: path, circle, ellipse, line, polyline,
 * polygon, rect (boleh dibungkus <g>). Warna/stroke asli SVG diabaikan
 * — warna ditentukan oleh animasi (aksen orang / warna ikon).
 * ------------------------------------------------------------------ */

export type SvgIconMode = "outline" | "fill";

export interface SvgIcon {
  id: string;
  /** Nama untuk dashboard */
  name: string;
  /** Kode SVG mentah (sudah lolos pemeriksaan keamanan) */
  svg: string;
  /** "outline" = garis neon menggambar diri; "fill" = area terisi naik */
  mode: SvgIconMode;
  /** Hex warna khusus. Kosong = ikut warna aksen orang. */
  color: string;
}

/** Nilai iconId di LineConfig untuk baris tanpa ikon. */
export const ICON_NONE = "none";

export const MAX_ICONS = 24;
export const MAX_SVG_CHARS = 40_000;
export const MAX_SHAPES = 200;

export const SVG_MODES: { value: SvgIconMode; label: string; hint: string }[] =
  [
    {
      value: "outline",
      label: "Outline neon",
      hint: "Garis tepi menggambar diri dengan cahaya neon",
    },
    {
      value: "fill",
      label: "Fill (terisi)",
      hint: "Area di dalam outline terisi dari bawah ke atas",
    },
  ];

/* ------------------------------------------------------------------
 * Pemeriksaan sumber (string) — aman dipakai di server maupun client.
 * ------------------------------------------------------------------ */
// Hanya yang berbahaya yang ditolak. <style>, <defs>, <use>, <image>, dll.
// (umum di ekspor Illustrator/Inkscape) tidak ditolak — cukup diabaikan
// saat render karena hanya bentuk whitelist yang digambar ulang.
const FORBIDDEN_SOURCE =
  /<\s*(script|foreignObject|iframe|object|embed)\b|<!ENTITY|<!DOCTYPE[^>]*\[|\son[a-z]+\s*=|javascript\s*:|data\s*:text\/html/i;

/** Mengembalikan pesan error, atau null jika sumber layak diproses. */
export function checkSvgSource(code: string): string | null {
  const t = code.trim();
  if (!t) return "Kode SVG kosong.";
  if (t.length > MAX_SVG_CHARS)
    return `Kode SVG terlalu panjang (maks ${MAX_SVG_CHARS.toLocaleString("id-ID")} karakter).`;
  if (!/<\s*svg[\s>]/i.test(t)) return "Kode harus mengandung elemen <svg>.";
  if (FORBIDDEN_SOURCE.test(t))
    return "SVG mengandung elemen/atribut berbahaya (script, foreignObject, event handler onXXX, javascript:).";
  return null;
}

/* ------------------------------------------------------------------
 * Pohon SVG hasil parse (hanya yang diizinkan)
 * ------------------------------------------------------------------ */
export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
}

export interface ParsedSvg {
  viewBox: [number, number, number, number];
  nodes: SvgNode[];
  shapeCount: number;
}

const SHAPE_TAGS = new Set([
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "rect",
]);

const SAFE_TEXT = /^[0-9a-zA-Z\s.,+\-%()]*$/;
const ALLOWED_ATTRS: Record<string, RegExp> = {
  d: /^[0-9a-zA-Z\s.,+\-]*$/,
  points: /^[0-9\s.,+\-eE]*$/,
  transform: SAFE_TEXT,
  cx: SAFE_TEXT,
  cy: SAFE_TEXT,
  r: SAFE_TEXT,
  rx: SAFE_TEXT,
  ry: SAFE_TEXT,
  x: SAFE_TEXT,
  y: SAFE_TEXT,
  x1: SAFE_TEXT,
  y1: SAFE_TEXT,
  x2: SAFE_TEXT,
  y2: SAFE_TEXT,
  width: SAFE_TEXT,
  height: SAFE_TEXT,
  "fill-rule": /^(nonzero|evenodd)$/,
};

function readViewBox(svg: Element): [number, number, number, number] {
  const vb = svg.getAttribute("viewBox") ?? svg.getAttribute("viewbox");
  if (vb) {
    const n = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (n.length === 4 && n.every(Number.isFinite) && n[2] > 0 && n[3] > 0) {
      return [n[0], n[1], n[2], n[3]];
    }
  }
  const w = parseFloat(svg.getAttribute("width") ?? "");
  const h = parseFloat(svg.getAttribute("height") ?? "");
  if (Number.isFinite(w) && Number.isFinite(h) && w >= 4 && h >= 4) {
    return [0, 0, w, h];
  }
  return [0, 0, 24, 24];
}

function walk(el: Element, counter: { n: number }): SvgNode[] {
  const out: SvgNode[] = [];
  for (const child of Array.from(el.children)) {
    const tag = child.localName.toLowerCase();
    if (tag !== "g" && !SHAPE_TAGS.has(tag)) continue;
    if (child.getAttribute("display") === "none") continue;

    const attrs: Record<string, string> = {};
    for (const [name, re] of Object.entries(ALLOWED_ATTRS)) {
      const v = child.getAttribute(name);
      if (v != null && re.test(v)) attrs[name] = v;
    }

    if (tag === "g") {
      const kids = walk(child, counter);
      if (kids.length) out.push({ tag, attrs, children: kids });
      continue;
    }
    // Bentuk dasar: abaikan elemen kosong tanpa geometri.
    const hasGeometry = Object.keys(attrs).some((k) => k !== "transform");
    if (!hasGeometry) continue;
    counter.n += 1;
    out.push({ tag, attrs, children: [] });
  }
  return out;
}

/**
 * Parse kode SVG di browser (butuh DOMParser). Parser HTML dipakai
 * agar toleran terhadap SVG yang tidak rapi (tanpa xmlns, tag tak
 * ditutup, dsb.).
 */
export function parseSvg(
  code: string,
): { ok: true; value: ParsedSvg } | { ok: false; error: string } {
  const pre = checkSvgSource(code);
  if (pre) return { ok: false, error: pre };
  if (typeof DOMParser === "undefined")
    return { ok: false, error: "Parser SVG hanya berjalan di browser." };

  const doc = new DOMParser().parseFromString(code, "text/html");
  const svg = doc.querySelector("svg");
  if (!svg) return { ok: false, error: "Elemen <svg> tidak ditemukan." };

  const counter = { n: 0 };
  const nodes = walk(svg, counter);
  if (counter.n === 0)
    return {
      ok: false,
      error:
        "Tidak ada bentuk yang bisa dianimasikan. Gunakan path, circle, ellipse, line, polyline, polygon, atau rect (teks/gambar/gradient tidak didukung).",
    };
  if (counter.n > MAX_SHAPES)
    return {
      ok: false,
      error: `SVG terlalu kompleks (${counter.n} bentuk, maks ${MAX_SHAPES}). Sederhanakan dulu.`,
    };

  return {
    ok: true,
    value: { viewBox: readViewBox(svg), nodes, shapeCount: counter.n },
  };
}

/* ------------------------------------------------------------------
 * Normalisasi array ikon (dipakai API + client). Isomorfik.
 * ------------------------------------------------------------------ */
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function makeIconId(): string {
  return `ic_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function validateSvgIcons(
  raw: unknown,
): { icons: SvgIcon[]; error?: undefined } | { icons?: undefined; error: string } {
  if (!Array.isArray(raw)) return { error: "svgIcons harus berupa array." };
  if (raw.length > MAX_ICONS)
    return { error: `Maksimal ${MAX_ICONS} ikon per arsip.` };

  const icons: SvgIcon[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i] as Partial<SvgIcon> | null;
    const label = `Ikon #${i + 1}`;
    if (!r || typeof r !== "object") return { error: `${label} tidak valid.` };
    const id = typeof r.id === "string" ? r.id : "";
    if (!ID_RE.test(id)) return { error: `${label}: id tidak valid.` };
    if (seen.has(id)) return { error: `${label}: id ganda.` };
    seen.add(id);
    const svg = typeof r.svg === "string" ? r.svg.trim() : "";
    const bad = checkSvgSource(svg);
    if (bad) return { error: `${label}: ${bad}` };
    const color = typeof r.color === "string" ? r.color.trim() : "";
    if (color && !HEX_RE.test(color))
      return { error: `${label}: warna harus hex (mis. #e8a23d) atau kosong.` };
    icons.push({
      id,
      name:
        (typeof r.name === "string" ? r.name.trim() : "").slice(0, 40) ||
        `Ikon ${i + 1}`,
      svg,
      mode: r.mode === "fill" ? "fill" : "outline",
      color,
    });
  }
  return { icons };
}

/** Parse string JSON dari DB → SvgIcon[] (lunak: abaikan yang rusak). */
export function parseSvgIconsJson(json: string | null | undefined): SvgIcon[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (r): r is SvgIcon =>
        !!r &&
        typeof r.id === "string" &&
        typeof r.svg === "string" &&
        !checkSvgSource(r.svg),
    ).map((r) => ({
      id: r.id,
      name: typeof r.name === "string" ? r.name : "Ikon",
      svg: r.svg,
      mode: r.mode === "fill" ? "fill" : "outline",
      color: typeof r.color === "string" ? r.color : "",
    }));
  } catch {
    return [];
  }
}

/** Ikon yang dipakai sebuah baris: eksplisit → otomatis bergantian → tanpa. */
export function resolveLineIcon(
  lineIndex: number,
  iconId: string | undefined,
  icons: SvgIcon[],
): SvgIcon | null {
  if (!icons.length || iconId === ICON_NONE) return null;
  if (iconId) {
    const found = icons.find((i) => i.id === iconId);
    if (found) return found;
  }
  return icons[lineIndex % icons.length];
}

/* ------------------------------------------------------------------
 * Ikon contoh (satu klik di dashboard). Semua 24×24.
 * ------------------------------------------------------------------ */
const wrap = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`;

export const STARTER_ICONS: Omit<SvgIcon, "id">[] = [
  {
    name: "Hati",
    mode: "fill",
    color: "",
    svg: wrap(
      `<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 4.5 6.3 4.5c2 0 3.6 1.1 4.5 2.6.3.5.9.5 1.2 0 .9-1.5 2.5-2.6 4.5-2.6 3.6 0 5.4 3.9 3.9 7.3C19.5 16.4 12 21 12 21z"/>`,
    ),
  },
  {
    name: "Bintang",
    mode: "outline",
    color: "",
    svg: wrap(
      `<path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9z"/>`,
    ),
  },
  {
    name: "Not musik",
    mode: "outline",
    color: "",
    svg: wrap(
      `<circle cx="6.5" cy="17.5" r="3"/><rect x="8.5" y="4" width="2" height="13.5"/><circle cx="17.5" cy="15.5" r="3"/><rect x="18.5" y="2" width="2" height="13.5"/><polygon points="8.5,4 20.5,2 20.5,5.5 8.5,7.5"/>`,
    ),
  },
  {
    name: "Kilau",
    mode: "fill",
    color: "",
    svg: wrap(
      `<path d="M12 2c.6 4.9 2.5 8.4 8 10-5.5 1.6-7.4 5.1-8 10-.6-4.9-2.5-8.4-8-10 5.5-1.6 7.4-5.1 8-10z"/>`,
    ),
  },
  {
    name: "Bulan",
    mode: "outline",
    color: "",
    svg: wrap(`<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>`),
  },
];

export function starterToIcon(s: Omit<SvgIcon, "id">): SvgIcon {
  return { ...s, id: makeIconId() };
}
