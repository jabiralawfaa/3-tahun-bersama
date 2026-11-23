"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Memory } from "@/data/memories";
import { getMode } from "@/data/memories";
import {
  parseEnhancedLrc,
  findActiveLineIndex,
  findActiveWordIndex,
  buildPlainTimeline,
} from "@/lib/lrc";
import { usePerfMode, type PerfPref } from "@/lib/use-perf-mode";
import { useAuthStore } from "@/lib/auth-store";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { KineticLyrics } from "./components/KineticLyrics";
import { AudioPlayer } from "./components/AudioPlayer";
import { FinalConfession } from "./components/FinalConfession";

/**
 * Deteksi "sudah mount di client" tanpa setState-in-effect.
 * useSyncExternalStore memberi false di server, true di client —
 * transisi yang aman dari segi hidrasi React.
 */
const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Halaman Personal `/for/[slug]`
 * ------------------------------------------------------------------
 * Rute dinamis yang hanya bisa diakses setelah kode nama valid dimasukkan
 * di halaman gerbang `/`. Proteksi state sederhana: bila slug belum
 * di-unlock, arahkan kembali ke `/`.
 *
 * Mengorkestrasi:
 *  - parsing Enhanced LRC
 *  - engine audio HTML5 dengan sinkronisasi requestAnimationFrame presisi
 *  - kinetic lyrics multi-efek
 *  - dekorasi SVG beranimasi
 *  - adegan penutup saat lagu selesai
 * ------------------------------------------------------------------
 */
export default function PersonalPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const router = useRouter();
  const isUnlocked = useAuthStore((s) => s.isUnlocked);
  // Deteksi mount client (reliable di SSR + client nav, tanpa setState-in-effect).
  const isClient = useIsClient();
  // Backup: flag dari persist middleware (untuk async storage bila ada).
  const storeHydrated = useAuthStore((s) => s._hasHydrated ?? false);

  // Memory di-fetch dari API (DB). Loading state sampai tersedia.
  const [memory, setMemory] = useState<Memory | null>(null);
  const [loadingMemory, setLoadingMemory] = useState(true);

  /* ------------------- Audio engine state ------------------- */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  // currentTime hanya untuk tampilan pemutar (diperbarui ±4x/detik).
  // Baris & kata aktif disimpan sebagai state terpisah yang HANYA berubah
  // saat baris/kata berganti — jadi halaman tidak re-render 60x/detik.
  const [currentTime, setCurrentTime] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [activeWord, setActiveWord] = useState(-1);
  const [duration, setDuration] = useState(0);
  const { pref, setPref, low, autoLow, reportFrame } = usePerfMode();

  // Bangun timeline baris sesuai mode:
  //  - "lrc": parse Enhanced LRC (timestamp per baris + per kata).
  //  - "plain": bagi durasi lagu rata sesuai jumlah plainLines.
  const lines = useMemo(() => {
    if (!memory) return [];
    if (getMode(memory) === "lrc") {
      return parseEnhancedLrc(memory.enhancedLrc, memory.lineConfig);
    }
    // Plain mode — butuh duration; kosong sampai duration diketahui.
    return buildPlainTimeline(
      memory.plainLines ?? [],
      duration,
      memory.lineConfig,
    );
  }, [memory, duration]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Penyimpan terakhir agar setState hanya dipanggil saat nilai berubah.
  const linesRef = useRef(lines);
  const idxRef = useRef(-1);
  const wordRef = useRef(-1);
  const shownTimeRef = useRef(-1);

  const syncTime = useCallback((t: number) => {
    const ls = linesRef.current;
    const idx = findActiveLineIndex(ls, t);
    const w = idx >= 0 ? findActiveWordIndex(ls[idx], t) : -1;
    if (idx !== idxRef.current) {
      idxRef.current = idx;
      setActiveIndex(idx);
    }
    if (w !== wordRef.current) {
      wordRef.current = w;
      setActiveWord(w);
    }
    if (Math.abs(t - shownTimeRef.current) >= 0.25) {
      shownTimeRef.current = t;
      setCurrentTime(t);
    }
  }, []);

  // Timeline berubah (mode plain baru tahu durasi) → hitung ulang baris aktif.
  useEffect(() => {
    linesRef.current = lines;
    const a = audioRef.current;
    syncTime(a ? a.currentTime : 0);
  }, [lines, syncTime]);

  /* ------------------- Route guard + fetch memory ------------------- */
  // Tunggu sinyal mount client sebelum mengambil keputusan redirect,
  // agar tidak salah menganggap "belum di-unlock" saat load pertama.
  const hasHydrated = isClient || storeHydrated;
  useEffect(() => {
    if (!hasHydrated) return;
    if (!isUnlocked(slug)) {
      router.replace("/");
      return;
    }
    // Sudah unlock → ambil data memory dari API.
    // (loadingMemory sudah true dari state awal; tidak perlu setState
    //  sinkron di sini untuk menghindari cascading render.)
    let cancelled = false;
    fetch(`/api/memories/by-slug/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.memory) {
          setMemory(data.memory);
        } else {
          // Tidak ditemukan → kembali ke gerbang.
          router.replace("/");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/");
      })
      .finally(() => {
        if (!cancelled) setLoadingMemory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasHydrated, slug, isUnlocked, router]);

  /* ------------------- Sinkronisasi waktu presisi (rAF) ------------------- */
  // Loop rAF membaca audio.currentTime tiap frame (presisi), tetapi hanya
  // memanggil setState saat baris/kata aktif berganti. Frame yang sama
  // dipakai untuk mengukur FPS (mode ringan otomatis).
  const reportFrameRef = useRef(reportFrame);
  useEffect(() => {
    reportFrameRef.current = reportFrame;
  }, [reportFrame]);

  useEffect(() => {
    let rafId = 0;
    let last = 0;
    const loop = (now: number) => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        syncTime(audio.currentTime);
        if (last) reportFrameRef.current(now - last);
        last = now;
      } else {
        last = 0;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    rafRef.current = rafId;
    return () => {
      cancelAnimationFrame(rafId);
      rafRef.current = null;
    };
  }, [syncTime]);

  /* ------------------- Pelacakan duration yang andal ------------------- */
  // Beberapa mp3 memuat duration secara bertahap; gunakan beberapa event.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const readDuration = () => {
      if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    readDuration();
    audio.addEventListener("loadedmetadata", readDuration);
    audio.addEventListener("durationchange", readDuration);
    audio.addEventListener("progress", readDuration);
    audio.addEventListener("canplay", readDuration);
    return () => {
      audio.removeEventListener("loadedmetadata", readDuration);
      audio.removeEventListener("durationchange", readDuration);
      audio.removeEventListener("progress", readDuration);
      audio.removeEventListener("canplay", readDuration);
    };
  }, [memory?.slug]);

  /* ------------------- Kontrol audio ------------------- */
  // isPlaying disinkronkan via event onPlay/onPause audio (lihat JSX),
  // sehingga selalu mencerminkan keadaan elemen audio yang sebenarnya.
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio
        .play()
        .then(() => setStarted(true))
        .catch(() => {
          // Autoplay diblokir — biarkan tombol dicoba lagi oleh user.
        });
    } else {
      audio.pause();
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setEnded(true);
    // Mulai fade-out lapisan lirik/player sebelum menampilkan confession.
    setFadeOut(true);
  }, []);

  /* ------------------- Replay ------------------- */
  const replay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setEnded(false);
    setFadeOut(false);
    audio.currentTime = 0;
    syncTime(0);
    void audio
      .play()
      .then(() => setStarted(true))
      .catch(() => {
        // noop
      });
  }, [syncTime]);

  /* ------------------- Auto-play setelah navigasi ------------------- */
  // Saat masuk dari gerbang (gesture klik sudah terjadi), coba autoplay.
  // isPlaying akan disinkronkan otomatis via event onPlay audio.
  useEffect(() => {
    if (!memory || !hasHydrated) return;
    if (!isUnlocked(slug)) return;
    const audio = audioRef.current;
    if (!audio) return;
    // Beri jeda singkat agar transisi halus.
    const t = setTimeout(() => {
      audio
        .play()
        .then(() => setStarted(true))
        .catch(() => {
          // Autoplay ditolak; tunggu user menekan play.
        });
    }, 800);
    return () => clearTimeout(t);
  }, [hasHydrated, memory?.slug, isUnlocked, slug]);

  /* ------------------- Render ------------------- */
  // Tunggu hydrasi sebelum mengecek proteksi (cegah flash redirect).
  if (hasHydrated && !isUnlocked(slug)) {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center gap-4 bg-midnight-deep px-6 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--accent,#e8a23d)]/80">
          access-denied
        </p>
        <p className="text-sm text-muted-foreground">
          Halaman ini hanya bisa dibuka lewat kode nama yang benar.
        </p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
        >
          Kembali ke gerbang
        </button>
      </main>
    );
  }

  // Loading: tunggu data memory dari API.
  if (loadingMemory || !memory) {
    return (
      <main className="relative min-h-screen flex items-center justify-center bg-midnight-deep">
        <p className="font-mono text-sm text-muted-foreground">
          Memeriksa arsip…
        </p>
      </main>
    );
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  // Terapkan warna aksen per-orang dengan meng-override CSS variable
  // --amber-warm / --rose-warm pada wrapper ini. Semua kelas Tailwind
  // *-amber-warm / *-rose-warm (plus glow/gradient di globals.css) akan
  // otomatis memakai warna orang ini — tanpa perlu mengubah setiap kelas.
  const themeVars = {
    "--amber-warm": memory.theme.accent,
    "--rose-warm": memory.theme.accentSoft,
    backgroundColor: memory.theme.background,
  } as React.CSSProperties;

  return (
    <main
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={themeVars}
      data-perf={low ? "low" : "high"}
    >
      {/* Audio element (tersembunyi) */}
      <audio
        ref={audioRef}
        src={memory.audioSrc}
        preload="auto"
        // isPlaying & duration disinkronkan via event audio agar selalu
        // mencerminkan keadaan elemen yang sebenarnya (lihat juga useEffect).
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => {
          // Cadangan + saat seek ketika audio dijeda (rAF hanya jalan saat main).
          syncTime(e.currentTarget.currentTime);
        }}
        onEnded={handleEnded}
      />

      {/* Latar dekoratif beranimasi */}
      <AnimatedBackground
        decoration={memory.theme.decoration}
        activeBait={Math.max(0, activeIndex) % 3}
      />

      {/* Header bar ala editor */}
      <motion.header
        className="relative z-20 flex items-center justify-between px-5 sm:px-8 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
        animate={{ opacity: fadeOut ? 0 : 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-warm/80" />
          <span>for/{slug}</span>
          <span className="hidden sm:inline opacity-40">/</span>
          <span className="hidden sm:inline opacity-60 text-amber-warm/70">
            {memory.theme.label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <PerfToggle pref={pref} low={low} autoLow={autoLow} onChange={setPref} />
          <span className="hidden sm:inline opacity-70">{memory.role}</span>
        </div>
      </motion.header>

      {/* Lapisan utama yang memudar saat ending */}
      <div
        className="relative z-10 flex flex-1 flex-col"
        style={{
          opacity: fadeOut ? 0 : 1,
          // filter hanya dipasang saat memudar (blur permanen = lapisan mahal)
          filter: fadeOut && !low ? "blur(8px)" : "none",
          transition: "opacity 1.1s cubic-bezier(.22,1,.36,1), filter 1.1s cubic-bezier(.22,1,.36,1)",
        }}
      >
        {/* Prompt mulai (sebelum audio diputar pertama kali) */}
        <AnimatePresence>
          {!started && (
            <motion.div
              className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="max-w-md">
                <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber-warm/80">
                  press play to begin
                </p>
                <h1 className="mt-4 font-sans text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">
                  Sebuah surat, tersembunyi{" "}
                  <span className="text-warm-gradient">selama 3 tahun.</span>
                </h1>
                <p className="mt-4 text-sm text-muted-foreground">
                  Putar lagunya, dan biarkan setiap baris membuka apa yang
                  selama ini ku rapikan dalam diam.
                </p>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="mt-7 inline-flex items-center gap-2 rounded-lg bg-amber-warm/15 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-amber-warm transition-colors hover:bg-amber-warm/25"
                >
                  Mulai putar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Kinetic lyrics / ucapan */}
        <div className="flex-1 flex flex-col justify-center">
          <KineticLyrics
            lines={lines}
            activeIndex={activeIndex}
            activeWord={activeWord}
            isEnding={fadeOut}
            mode={getMode(memory)}
            icons={memory.svgIcons}
            iconLayout={memory.iconLayout}
          />
        </div>
      </div>

      {/* Audio player glassmorphic */}
      <AudioPlayer
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        currentTime={currentTime}
        duration={duration}
        progress={progress}
        songTitle={memory.songTitle}
        songArtist={memory.songArtist}
        fadingOut={fadeOut}
      />

      {/* Adegan penutup */}
      <AnimatePresence>
        {ended && (
          <FinalConfession
            message={memory.finalMessage}
            frameLabel={memory.finalFrameLabel}
            onReplay={replay}
          />
        )}
      </AnimatePresence>

      {/* Footer sticky — padding bawah ekstra agar tidak tertutup player fixed */}
      <motion.footer
        className="relative z-10 mt-auto px-5 sm:px-8 pt-3 pb-28 sm:pb-24 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50"
        animate={{ opacity: fadeOut ? 0 : 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate">kinetic-typography · enhanced-lrc</span>
          <span className="hidden sm:inline shrink-0">class-of-2022—2025</span>
        </div>
      </motion.footer>
    </main>
  );
}

/* ------------------------------------------------------------------
 * PerfToggle — pilih kualitas animasi (otomatis / ringan / penuh)
 * ------------------------------------------------------------------ */
const PERF_ORDER: PerfPref[] = ["auto", "low", "high"];
const PERF_LABEL: Record<PerfPref, string> = {
  auto: "otomatis",
  low: "ringan",
  high: "penuh",
};

function PerfToggle({
  pref,
  low,
  autoLow,
  onChange,
}: {
  pref: PerfPref;
  low: boolean;
  autoLow: boolean;
  onChange: (p: PerfPref) => void;
}) {
  const next = PERF_ORDER[(PERF_ORDER.indexOf(pref) + 1) % PERF_ORDER.length];
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`Kualitas animasi: ${PERF_LABEL[pref]}${
        pref === "auto" && autoLow ? " (beralih ke ringan karena perangkat lambat)" : ""
      }. Klik untuk ganti ke "${PERF_LABEL[next]}".`}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] tracking-[0.15em] text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          low ? "bg-muted-foreground/60" : "bg-amber-warm/80"
        }`}
      />
      <span>anim: {PERF_LABEL[pref]}</span>
      {pref === "auto" && low && <span className="opacity-60">· ringan</span>}
    </button>
  );
}
