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
import { memoryBySlug } from "@/data/memories";
import { parseEnhancedLrc, findActiveLineIndex } from "@/lib/lrc";
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

  const memory = memoryBySlug(slug);

  // Parse LRC sekali (memo). Aman walau memory undefined.
  const lines = useMemo(() => {
    if (!memory) return [];
    return parseEnhancedLrc(memory.enhancedLrc, memory.lineConfig);
  }, [memory]);

  /* ------------------- Audio engine state ------------------- */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  const activeIndex = useMemo(
    () => findActiveLineIndex(lines, currentTime),
    [lines, currentTime],
  );

  /* ------------------- Route guard ------------------- */
  // Tunggu sinyal mount client sebelum mengambil keputusan redirect,
  // agar tidak salah menganggap "belum di-unlock" saat load pertama.
  const hasHydrated = isClient || storeHydrated;
  useEffect(() => {
    if (!hasHydrated) return;
    if (!memory || !isUnlocked(slug)) {
      router.replace("/");
    }
  }, [hasHydrated, memory, slug, isUnlocked, router]);

  /* ------------------- Sinkronisasi waktu presisi (rAF) ------------------- */
  // Loop rAF berjalan terus selama komponen ter-mount dan hanya menulis
  // currentTime saat audio benar-benar diputar. Decoupled dari state
  // isPlaying agar sinkronisasi tetap presisi meski ada perbedaan state.
  useEffect(() => {
    let rafId = 0;
    const loop = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        setCurrentTime(audio.currentTime);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    rafRef.current = rafId;
    return () => {
      cancelAnimationFrame(rafId);
      rafRef.current = null;
    };
  }, []);

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
    setCurrentTime(0);
    audio.currentTime = 0;
    void audio
      .play()
      .then(() => setStarted(true))
      .catch(() => {
        // noop
      });
  }, []);

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
  if (!memory) {
    return (
      <main className="relative min-h-screen flex items-center justify-center bg-midnight-deep">
        <p className="font-mono text-sm text-muted-foreground">
          Memeriksa arsip…
        </p>
      </main>
    );
  }

  // Tunggu hydrasi sebelum mengecek proteksi (cegah flash redirect).
  if (hasHydrated && !isUnlocked(slug)) {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center gap-4 bg-midnight-deep px-6 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber-warm/80">
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

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <main className="relative min-h-screen flex flex-col overflow-hidden bg-midnight-deep">
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
          // Cadangan presisi menengah (rAF tetap andal sebagai utama).
          setCurrentTime(e.currentTarget.currentTime);
        }}
        onEnded={handleEnded}
      />

      {/* Latar dekoratif beranimasi */}
      <AnimatedBackground
        decoration={memory.theme.decoration}
        activeBait={Math.max(0, activeIndex)}
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
        <div className="hidden sm:flex items-center gap-3 opacity-70">
          <span>{memory.role}</span>
        </div>
      </motion.header>

      {/* Lapisan utama yang memudar saat ending */}
      <motion.div
        className="relative z-10 flex flex-1 flex-col"
        animate={{
          opacity: fadeOut ? 0 : 1,
          filter: fadeOut ? "blur(8px)" : "blur(0px)",
        }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
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

        {/* Kinetic lyrics */}
        <div className="flex-1 flex flex-col justify-center">
          <KineticLyrics
            lines={lines}
            activeIndex={activeIndex}
            currentTime={currentTime}
            isEnding={fadeOut}
          />
        </div>
      </motion.div>

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
