"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { formatTime } from "@/lib/lrc";

/**
 * AudioPlayer
 * ------------------------------------------------------------------
 * Kontrol pemutar musik tipis, glassmorphic, mengambang di bawah.
 * Memudar otomatis saat lagu selesai (prop `fadingOut`).
 * ------------------------------------------------------------------
 */
interface AudioPlayerProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  progress: number; // 0..1
  songTitle: string;
  songArtist: string;
  fadingOut: boolean;
}

export const AudioPlayer = memo(function AudioPlayer({
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  progress,
  songTitle,
  songArtist,
  fadingOut,
}: AudioPlayerProps) {
  // currentTime hanya diperbarui ±4x/detik oleh halaman; bar bergerak halus
  // lewat transition CSS (transform/left), bukan animasi framer per frame.
  const pct = Math.max(0, Math.min(1, progress)) * 100;

  return (
    <AnimatePresence>
      {!fadingOut && (
        <motion.div
          className="fixed bottom-5 left-1/2 z-30 w-[min(680px,calc(100vw-2.5rem))] -translate-x-1/2"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative overflow-hidden perf-glass rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
            {/* Aksen glow di belakang tombol */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-10 left-6 h-24 w-24 glow-amber opacity-40"
            />

            <div className="relative flex items-center gap-4">
              {/* Tombol Play / Pause */}
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? "Jeda" : "Putar"}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-warm/30 bg-amber-warm/15 text-amber-warm transition-colors hover:bg-amber-warm/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-warm/40"
              >
                {isPlaying ? (
                  <Pause className="h-4.5 w-4.5" />
                ) : (
                  <Play className="h-4.5 w-4.5 translate-x-[1px]" />
                )}
              </button>

              {/* Info lagu + progress */}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-sans text-sm font-medium text-foreground">
                      {songTitle}
                    </p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                      {songArtist}
                    </p>
                  </div>
                  <div className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/80">
                    {formatTime(currentTime)}{" "}
                    <span className="text-muted-foreground/40">/</span>{" "}
                    {formatTime(duration)}
                  </div>
                </div>

                {/* Progress bar tipis */}
                <div
                  className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="absolute inset-y-0 left-0 w-full origin-left rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, var(--amber-warm), var(--rose-warm))",
                      transform: `scaleX(${pct / 100})`,
                      transition: "transform 0.3s linear",
                    }}
                  />
                  {/* Titik indikator */}
                  <div
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-white/40 bg-amber-warm"
                    style={{
                      left: `calc(${pct}% - 5px)`,
                      transition: "left 0.3s linear",
                      boxShadow:
                        "0 0 10px color-mix(in srgb, var(--amber-warm) 60%, transparent)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
