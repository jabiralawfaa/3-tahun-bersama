/**
 * data/memories.ts
 * ------------------------------------------------------------------
 * Konfigurasi modular arsip kenangan kelulusan kelas 3 tahun.
 *
 * Setiap entri mewakili satu orang dengan "Kode Nama" rahasia.
 * Untuk menambah teman sekelas baru, cukup salin satu blok `Memory`
 * dan sesuaikan: code, slug, theme, audioSrc, enhancedLrc,
 * lineConfig (refleksi + preset animasi per baris), dan finalMessage.
 *
 * Preset animasi yang tersedia:
 *  - "3d-flip"    : rotasi ruang 3D (rotateX/rotateY, perspective)
 *  - "zoom-in"    : scale 0.7 -> 1 dengan spring physics
 *  - "zoom-out"   : scale 1 -> 1.25 fade out (efek kamera)
 *  - "blur-fade"  : blur(12px) -> blur(0px) + pergeseran vertikal sinematik
 * ------------------------------------------------------------------
 */

export type AnimationPreset = "3d-flip" | "zoom-in" | "zoom-out" | "blur-fade";

export type DecorationKind = "bezier" | "constellation" | "orbit";

export interface MemoryTheme {
  /** Label tema pendek untuk identitas (mis. "Interactive Design Canvas") */
  label: string;
  /** Warna aksen utama (warm amber) */
  accent: string;
  /** Warna aksen sekunder (warm rose) */
  accentSoft: string;
  /** Warna latar dasar */
  background: string;
  /** Jenis dekorasi SVG yang ditonjolkan */
  decoration: DecorationKind;
}

export interface LineConfig {
  /** Subteks refleksi / pengakuan perasaan pribadi selama 3 tahun */
  reflection: string;
  /** Preset animasi kinetic typography untuk baris ini */
  animationPreset: AnimationPreset;
}

export interface Memory {
  /** ID internal (dari DB). Opsional untuk entri yang belum disimpan. */
  id?: string;
  /** Kode nama rahasia yang diketik di halaman gerbang */
  code: string;
  /** URL slug untuk rute /for/[slug] */
  slug: string;
  /** Nama tampilan (opsional, hanya untuk label internal) */
  name: string;
  /** Peran / identitas singkat */
  role: string;
  /** Tema visual */
  theme: MemoryTheme;
  /** Path file audio MP3 (relatif terhadap /public) */
  audioSrc: string;
  /** Judul lagu untuk label player */
  songTitle: string;
  /** Artis lagu */
  songArtist: string;
  /** String format Enhanced LRC (timestamp per baris + per kata) */
  enhancedLrc: string;
  /** Pemetaan refleksi & preset animasi per baris (sejajar urutan LRC) */
  lineConfig: LineConfig[];
  /** Pesan penutup yang muncul saat lagu selesai */
  finalMessage: string;
  /** Label monospace kecil di sudut frame penutup */
  finalFrameLabel: string;
  /** Timestamp (dari DB) */
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------
 * Enhanced LRC — Surat Cinta untuk Starla (Virgoun)
 * Format: [mm:ss.xx] baris, lalu <mm:ss.xx>kata per kata.
 * ------------------------------------------------------------------ */
const STARLA_LRC = `[ti:Surat Cinta untuk Starla]
[length:02:14.61]
[re:enhanced]
[00:00.75]<00:00.75>Bila <00:01.11>habis <00:01.67>sudah <00:03.30>waktu <00:04.07>ini
[00:04.97]<00:04.97>Tak <00:05.46>lagi <00:06.18>berpijak <00:08.02>pada <00:08.61>dunia
[00:09.96]<00:09.96>Telah <00:10.89>aku <00:11.53>habiskan
[00:13.27]<00:13.27>Sisa <00:14.10>hidupku <00:15.06>hanya <00:16.21>untukmu
[00:20.11]<00:20.11>Dan <00:20.74>telah <00:21.23>habis <00:21.74>sudah <00:23.11>cinta <00:23.75>ini
[00:24.91]<00:24.91>'Tak <00:25.32>lagi <00:26.01>tersisa <00:28.05>untuk <00:28.62>dunia
[00:30.00]<00:30.00>Karena <00:30.74>telah <00:31.20>'ku <00:31.61>habiskan
[00:33.19]<00:33.19>Sisa <00:34.00>cintaku <00:34.89>hanya <00:36.02>untukmu
[00:41.46]<00:41.46>Untukmu
[00:45.52]<00:45.52>Hidup <00:46.44>dan <00:46.91>matiku
[00:54.99]<00:54.99>Bila <00:55.73>musim <00:56.40>berganti
[00:59.96]<00:59.96>Sampai <01:00.68>waktu <01:01.48>terhenti
[01:05.00]<01:05.00>Walau <01:05.65>dunia <01:06.45>membenci
[01:10.01]<01:10.01>'Ku <01:10.33>'kan <01:10.73>tetap <01:11.59>di <01:12.08>sini
[01:14.97]<01:14.97>Bila <01:15.71>habis <01:16.76>sudah <01:18.20>waktu <01:18.96>ini
[01:19.87]<01:19.87>Tak <01:20.33>lagi <01:21.15>berpijak <01:23.08>pada <01:23.62>dunia
[01:24.96]<01:24.96>Telah <01:25.91>aku <01:26.51>habiskan
[01:28.26]<01:28.26>Sisa <01:29.02>hidupku <01:30.20>hanya <01:31.22>untukmu
[01:34.95]<01:34.95>Telah <01:36.17>habis <01:36.67>sudah <01:38.00>cinta <01:38.96>ini
[01:39.91]<01:39.91>Tak <01:40.47>lagi <01:41.10>tersisa <01:43.08>untuk <01:43.64>dunia
[01:44.85]<01:44.85>Karena <01:45.80>telah <01:46.37>'ku <01:46.73>habiskan
[01:48.20]<01:48.20>Sisa <01:49.04>cintaku <01:50.06>hanya <01:51.16>untukmu
[01:55.05]<01:55.05>Karena <01:55.72>telah <01:56.15>'ku <01:56.65>habiskan
[01:58.16]<01:58.16>Sisa <01:59.04>cintaku <01:59.92>hanya <02:01.12>untukmu
`;

/**
 * Pemetaan refleksi & preset animasi per baris lirik.
 * Urutan sejajar dengan baris LRC di atas (24 baris lirik).
 * Refleksi ditulis sebagai pengakuan perasaan pribadi selama 3 tahun
 * di kelas, terikat emosi pada baris lirik yang bersangkutan.
 */
const STARLA_LINE_CONFIG: LineConfig[] = [
  {
    reflection:
      "Tiga tahun berlalu secepat kedipan mata — dan aku masih di sini, diam mengagumi mu dari kursi yang berbeda.",
    animationPreset: "blur-fade",
  },
  {
    reflection:
      "Dunia kelas kita terus berputar, tapi pandanganku selalu tanpa sadar kembali ke sudut tempatmu duduk.",
    animationPreset: "blur-fade",
  },
  {
    reflection:
      "Setiap detik istirahat dan jeda pelajaran, aku habiskan diam-diam mengamati cara mu tersenyum.",
    animationPreset: "zoom-in",
  },
  {
    reflection:
      "Tanpa kamu pernah tahu, sisa hari-hariku penuh dengan bayangmu yang tak pernah pergi.",
    animationPreset: "zoom-in",
  },
  {
    reflection:
      "Cinta ini tumbuh perlahan — dari sekadar kagum menjadi alasan untuk datang lebih pagi ke kelas.",
    animationPreset: "zoom-out",
  },
  {
    reflection:
      "Tak ada ruang lagi untuk yang lain; hatiku sudah penuh, tertata rapi seperti layer-layer di canvas desainmu.",
    animationPreset: "zoom-out",
  },
  {
    reflection:
      "Tiga tahun aku habiskan menahan, menyimpan, dan merahasiakan — di balik setiap kode yang kutulis.",
    animationPreset: "3d-flip",
  },
  {
    reflection:
      "Setiap baris kode, setiap pixel, setiap frame — diam-diam kupersembahkan untukmu.",
    animationPreset: "3d-flip",
  },
  {
    reflection:
      "Untukmu, mahasiswa IT yang mencintai desain UI/UX — yang diam-diam membuatku jatuh tanpa pernah berkata apa-apa.",
    animationPreset: "zoom-in",
  },
  {
    reflection:
      "Kau menjadi alasan dan jawaban dari setiap pertanyaan yang tak pernah berani kuucapkan.",
    animationPreset: "zoom-in",
  },
  {
    reflection:
      "Dari semester ke semester, dari musim ke musim — rasa ini tak pernah sekali pun pudar.",
    animationPreset: "blur-fade",
  },
  {
    reflection:
      "Bahkan saat kelak kita berpisah, momen ini akan ku hentikan dalam ingatan, abadi.",
    animationPreset: "zoom-out",
  },
  {
    reflection:
      "Biar dunia tak setuju, biar tak ada yang mengerti — aku tak pernah sekalipun ragu.",
    animationPreset: "3d-flip",
  },
  {
    reflection:
      "Aku akan tetap menunggu, di sudut kelas dan sudut hati, diam namun setia.",
    animationPreset: "zoom-out",
  },
  {
    reflection:
      "Kelulusan ini bukan akhir — melainkan awal dari sebuah pengakuan yang lama tertunda.",
    animationPreset: "3d-flip",
  },
  {
    reflection:
      "Kini aku berdiri di hadapanmu, melepaskan seluruh keraguan yang kutahan selama tiga tahun.",
    animationPreset: "blur-fade",
  },
  {
    reflection:
      "Tiga tahun kuhabiskan merancang momen ini — di latar belakang, tak pernah terlihat.",
    animationPreset: "zoom-in",
  },
  {
    reflection:
      "Setiap desain, setiap tata letak, setiap detail — semua, untukmu.",
    animationPreset: "zoom-in",
  },
  {
    reflection:
      "Cinta yang sekali ini tumbuh — tak akan pernah terulang, tak akan pernah terganti.",
    animationPreset: "zoom-out",
  },
  {
    reflection:
      "Seluruh hatiku habis — hanya tersisa untuk satu nama yang sama.",
    animationPreset: "3d-flip",
  },
  {
    reflection:
      "Karena selama ini, diam-diam, aku habiskan seluruh hatiku untukmu.",
    animationPreset: "blur-fade",
  },
  {
    reflection:
      "Untukmu, starla kecilku — selamanya.",
    animationPreset: "zoom-in",
  },
  {
    reflection:
      "Karena selama ini… tiga tahun penuh… aku habiskan untukmu.",
    animationPreset: "zoom-out",
  },
  {
    reflection:
      "Dan inilah akhirnya — pengakuanku yang selama tiga tahun ku rapikan dalam diam.",
    animationPreset: "blur-fade",
  },
];

/* ------------------------------------------------------------------
 * Nilai default tema (dipakai saat entri baru dibuat di dashboard).
 * Palet hangat-lampu-malam sebagai tanda tangan koleksi.
 * ------------------------------------------------------------------ */
export const MEMORY_DEFAULTS = {
  role: "Teman Kelas",
  themeLabel: "Interactive Design Canvas & Editorial Motion",
  /** Amber hangat */
  accent: "#e8a23d",
  /** Rose hangat */
  accentSoft: "#d96a4f",
  /** Deep midnight */
  background: "#13131f",
  decoration: "bezier" as DecorationKind,
  finalFrameLabel: "Final_Confession.tsx",
};

/** Daftar preset animasi yang valid (untuk dropdown dashboard). */
export const ANIMATION_PRESETS: AnimationPreset[] = [
  "blur-fade",
  "zoom-in",
  "zoom-out",
  "3d-flip",
];

/** Daftar jenis dekorasi yang valid. */
export const DECORATION_KINDS: DecorationKind[] = [
  "bezier",
  "constellation",
  "orbit",
];

/* ------------------------------------------------------------------
 * Seed: entri starla (dipakai scripts/seed.ts untuk mengisi DB awal).
 * ------------------------------------------------------------------ */
export const STARLA_SEED: Memory = {
  code: "starla",
  slug: "starla",
  name: "Starla",
  role: "Mahasiswa IT & UI/UX Designer",
  theme: {
    label: "Interactive Design Canvas & Editorial Motion",
    accent: "#e8a23d",
    accentSoft: "#d96a4f",
    background: "#13131f",
    decoration: "bezier",
  },
  audioSrc: "/audio/surat-cinta-untuk-starla.mp3",
  songTitle: "Surat Cinta untuk Starla",
  songArtist: "Virgoun",
  enhancedLrc: STARLA_LRC,
  lineConfig: STARLA_LINE_CONFIG,
  finalMessage:
    "Entah kamu sadar atau tidak, selama 3 tahun ini, aku mencintaimu",
  finalFrameLabel: "Final_Confession.tsx",
};

/* ------------------------------------------------------------------
 * Serialisasi DB <-> tipe Memory
 * ------------------------------------------------------------------ */

/** Bentuk mentah baris DB (Prisma). */
export interface MemoryDbRow {
  id: string;
  code: string;
  slug: string;
  name: string;
  role: string;
  themeLabel: string;
  accent: string;
  accentSoft: string;
  background: string;
  decoration: string;
  audioSrc: string;
  songTitle: string;
  songArtist: string;
  enhancedLrc: string;
  lineConfig: string; // JSON string
  finalMessage: string;
  finalFrameLabel: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Ubah baris DB → tipe Memory yang dikonsumsi komponen. */
export function memoryFromDb(row: MemoryDbRow): Memory {
  let lineConfig: LineConfig[] = [];
  try {
    const parsed = JSON.parse(row.lineConfig);
    if (Array.isArray(parsed)) lineConfig = parsed as LineConfig[];
  } catch {
    lineConfig = [];
  }
  return {
    id: row.id,
    code: row.code,
    slug: row.slug,
    name: row.name,
    role: row.role,
    theme: {
      label: row.themeLabel,
      accent: row.accent,
      accentSoft: row.accentSoft,
      background: row.background,
      decoration: normalizeDecoration(row.decoration),
    },
    audioSrc: row.audioSrc,
    songTitle: row.songTitle,
    songArtist: row.songArtist,
    enhancedLrc: row.enhancedLrc,
    lineConfig,
    finalMessage: row.finalMessage,
    finalFrameLabel: row.finalFrameLabel,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeDecoration(d: string): DecorationKind {
  return (DECORATION_KINDS as string[]).includes(d)
    ? (d as DecorationKind)
    : "bezier";
}
