"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import {
  findActiveWordIndex,
  formatTime,
  type ParsedLrcLine,
} from "@/lib/lrc";
import type { AnimationPreset, MemoryMode } from "@/data/memories";

/**
 * KineticLyrics
 * ------------------------------------------------------------------
 * Mesin kinetic typography multi-efek.
 *
 * - Menampilkan baris lirik aktif dengan transisi yang bervariasi
 *   antar baris sesuai `animationPreset` (3d-flip / zoom-in /
 *   zoom-out / blur-fade).
 * - Sinkronisasi per kata: kata yang sedang dinyanyikan menyala
 *   terang, terangkat, berubah warna aksen.
 * - Lapisan subteks: di bawah baris aktif, tampilkan refleksi
 *   pribadi 3 tahun dalam tipografi editorial serif italic.
 * - Bingkai selection-frame ala Figma di sekeliling baris aktif.
 * ------------------------------------------------------------------
 */
interface KineticLyricsProps {
  lines: ParsedLrcLine[];
  activeIndex: number;
  currentTime: number;
  isEnding: boolean;
  /** Mode tampilan: "lrc" (lirik + highlight per kata) atau "plain" (ucapan hero). */
  mode?: MemoryMode;
}

export function KineticLyrics({
  lines,
  activeIndex,
  currentTime,
  isEnding,
  mode = "lrc",
}: KineticLyricsProps) {
  const activeLine = activeIndex >= 0 ? lines[activeIndex] : undefined;
  const nextLine =
    activeIndex >= 0 && activeIndex + 1 < lines.length
      ? lines[activeIndex + 1]
      : undefined;
  const prevLine = activeIndex > 0 ? lines[activeIndex - 1] : undefined;

  // Ambil preset untuk baris aktif
  const preset = activeLine?.animationPreset ?? "blur-fade";

  return (
    <div
      className="relative z-10 flex min-h-[58vh] flex-col items-center justify-center px-5 sm:px-8"
      aria-live="polite"
    >
      {/* Label monospace kecil — alat bantu desainer */}
      <div className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-warm/80" />
        <span>{mode === "plain" ? "spoken" : "kinetic-lyrics"}</span>
        <span className="opacity-40">·</span>
        <span className="text-amber-warm/70">{preset}</span>
      </div>

      <AnimatePresence mode="popLayout">
        {!isEnding && activeLine && (
          <motion.div
            key={`line-${activeLine.index}`}
            className="flex w-full max-w-4xl flex-col items-center"
          >
            {/* Baris sebelumnya (preview redup di atas) */}
            {prevLine && (
              <PreviewLine text={prevLine.text} side="prev" />
            )}

            {/* Baris aktif dengan selection frame + animasi preset */}
            <div className="selection-frame relative my-3 px-6 py-4">
              {mode === "plain" ? (
                <PlainHeroLine line={activeLine} preset={preset} />
              ) : (
                <PresetLine
                  line={activeLine}
                  currentTime={currentTime}
                  preset={preset}
                />
              )}
              {/* Label waktu + indeks di sudut frame (ala editor) */}
              <div className="absolute -top-5 left-0 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-warm/60">
                {mode === "plain" ? "spoken_" : "line_"}
                {String(activeLine.index + 1).padStart(2, "0")} ·{" "}
                {formatTime(activeLine.time)}
              </div>
              <div className="absolute -bottom-5 right-0 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
                {mode === "plain"
                  ? `${lines.length} lines`
                  : `${activeLine.words.length} words`}
              </div>
            </div>

            {/* Subteks refleksi — editorial serif italic.
                Hanya di mode LRC. Mode plain: ucapan sudah jadi hero utama. */}
            {mode === "lrc" && (
              <AnimatePresence mode="wait">
                <motion.p
                  key={`ref-${activeLine.index}`}
                  className="mt-8 max-w-xl text-center font-serif italic text-base sm:text-lg leading-relaxed text-foreground/70"
                  initial={{
                    opacity: 0,
                    y: 12,
                    filter: "blur(8px)",
                  }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{
                    opacity: 0,
                    y: -10,
                    filter: "blur(8px)",
                  }}
                  transition={{
                    duration: 0.9,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.25,
                  }}
                >
                  <span className="mr-1 text-amber-warm/50">“</span>
                  {activeLine.reflection}
                  <span className="ml-1 text-amber-warm/50">”</span>
                </motion.p>
              </AnimatePresence>
            )}

            {/* Baris berikutnya (preview redup di bawah) */}
            {nextLine && <PreviewLine text={nextLine.text} side="next" />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------------------------------------------
 * PreviewLine — baris tetangga yang tampil redup
 * ---------------------------------------------------------------- */
function PreviewLine({ text, side }: { text: string; side: "prev" | "next" }) {
  return (
    <motion.p
      className={`max-w-2xl text-center text-sm sm:text-base text-muted-foreground/50 ${
        side === "prev" ? "mb-2" : "mt-2"
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {text}
    </motion.p>
  );
}

/* ----------------------------------------------------------------
 * PlainHeroLine — mode "plain": ucapan biasa sebagai hero utama.
 * Tidak ada highlight per kata. Seluruh teks tampil besar dalam warna
 * aksen dengan glow lembut yang "bernapas" — menonjolkan ucapan.
 * Animasi entrance/exit mengikuti preset baris.
 * ---------------------------------------------------------------- */
function PlainHeroLine({
  line,
  preset,
}: {
  line: ParsedLrcLine;
  preset: AnimationPreset;
}) {
  const spring = { type: "spring" as const, stiffness: 130, damping: 18, mass: 0.9 };
  const ease = { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const };
  const common =
    "text-center font-sans text-4xl sm:text-6xl md:text-7xl font-semibold leading-[1.15] tracking-tight";

  let motionProps: {
    initial: Record<string, number | string>;
    animate: Record<string, number | string>;
    exit: Record<string, number | string>;
    transition: typeof spring | typeof ease;
    style?: React.CSSProperties;
  };

  switch (preset) {
    case "3d-flip":
      motionProps = {
        initial: { rotateX: 80, rotateY: -18, opacity: 0 },
        animate: { rotateX: 0, rotateY: 0, opacity: 1 },
        exit: { rotateX: -70, rotateY: 16, opacity: 0 },
        transition: spring,
        style: { perspective: 1000 },
      };
      break;
    case "zoom-in":
      motionProps = {
        initial: { scale: 0.7, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 1.18, opacity: 0 },
        transition: spring,
      };
      break;
    case "zoom-out":
      motionProps = {
        initial: { scale: 1.18, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.78, opacity: 0, filter: "blur(6px)" },
        transition: spring,
      };
      break;
    case "blur-fade":
    default:
      motionProps = {
        initial: { y: 24, opacity: 0, filter: "blur(12px)" },
        animate: { y: 0, opacity: 1, filter: "blur(0px)" },
        exit: { y: -24, opacity: 0, filter: "blur(12px)" },
        transition: ease,
      };
      break;
  }

  return (
    <motion.div
      className={common}
      initial={motionProps.initial}
      animate={motionProps.animate}
      exit={motionProps.exit}
      transition={motionProps.transition}
      style={motionProps.style}
    >
      {/* Glow bernapas — memberi "nyawa" karena tidak ada highlight per kata */}
      <motion.span
        className="inline-block"
        style={{
          color: "var(--amber-warm)",
        }}
        animate={{
          textShadow: [
            "0 0 24px color-mix(in srgb, var(--amber-warm) 30%, transparent)",
            "0 0 40px color-mix(in srgb, var(--amber-warm) 55%, transparent)",
            "0 0 24px color-mix(in srgb, var(--amber-warm) 30%, transparent)",
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {line.text}
      </motion.span>
    </motion.div>
  );
}

/* ----------------------------------------------------------------
 * PresetLine — menerapkan animasi sesuai preset
 * ---------------------------------------------------------------- */
function PresetLine({
  line,
  currentTime,
  preset,
}: {
  line: ParsedLrcLine;
  currentTime: number;
  preset: AnimationPreset;
}) {
  switch (preset) {
    case "3d-flip":
      return <FlipLine line={line} currentTime={currentTime} />;
    case "zoom-in":
      return <ZoomInLine line={line} currentTime={currentTime} />;
    case "zoom-out":
      return <ZoomOutLine line={line} currentTime={currentTime} />;
    case "blur-fade":
    default:
      return <BlurFadeLine line={line} currentTime={currentTime} />;
  }
}

/* ---------- Kata dasar dengan highlight sinkron ---------- */
function Word({
  text,
  active,
  accentActive,
}: {
  text: string;
  active: boolean;
  accentActive?: boolean;
}) {
  return (
    <motion.span
      className="inline-block whitespace-pre"
      animate={{
        y: active ? -2 : 0,
        color: active
          ? "var(--amber-warm)"
          : "oklch(0.86 0.01 270 / 0.55)",
        textShadow: active
          ? "0 0 18px color-mix(in srgb, var(--amber-warm) 45%, transparent)"
          : "0 0 0px rgba(0,0,0,0)",
      }}
      transition={{
        type: "spring",
        stiffness: 320,
        damping: 22,
        mass: 0.6,
      }}
      style={accentActive ? { color: "var(--amber-warm)" } : undefined}
    >
      {text}
    </motion.span>
  );
}

function renderWords(
  line: ParsedLrcLine,
  currentTime: number,
): React.ReactNode {
  const activeWord = findActiveWordIndex(line, currentTime);
  return line.words.map((w, i) => (
    <Word key={i} text={w.text} active={i === activeWord} />
  ));
}

/* ---------- 3D Perspective Flip / Tilt ---------- */
function FlipLine({
  line,
  currentTime,
}: {
  line: ParsedLrcLine;
  currentTime: number;
}) {
  return (
    <motion.div
      style={{ perspective: 1000 }}
      initial={{ rotateX: 80, rotateY: -18, z: -120, opacity: 0 }}
      animate={{ rotateX: 0, rotateY: 0, z: 0, opacity: 1 }}
      exit={{ rotateX: -70, rotateY: 16, z: -120, opacity: 0 }}
      transition={{
        type: "spring",
        stiffness: 120,
        damping: 16,
        mass: 1,
      }}
      className="text-center font-sans text-3xl sm:text-5xl md:text-6xl font-semibold leading-tight tracking-tight"
    >
      {renderWords(line, currentTime)}
    </motion.div>
  );
}

/* ---------- Zoom In (scale 0.7 -> 1, spring) ---------- */
function ZoomInLine({
  line,
  currentTime,
}: {
  line: ParsedLrcLine;
  currentTime: number;
}) {
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.18, opacity: 0 }}
      transition={{
        type: "spring",
        stiffness: 140,
        damping: 18,
        mass: 0.9,
      }}
      className="text-center font-sans text-3xl sm:text-5xl md:text-6xl font-semibold leading-tight tracking-tight"
    >
      {renderWords(line, currentTime)}
    </motion.div>
  );
}

/* ---------- Zoom Out (membesar saat keluar — efek kamera) ---------- */
function ZoomOutLine({
  line,
  currentTime,
}: {
  line: ParsedLrcLine;
  currentTime: number;
}) {
  return (
    <motion.div
      initial={{ scale: 1.18, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.78, opacity: 0, filter: "blur(6px)" }}
      transition={{
        type: "spring",
        stiffness: 130,
        damping: 20,
        mass: 0.9,
      }}
      className="text-center font-sans text-3xl sm:text-5xl md:text-6xl font-semibold leading-tight tracking-tight"
    >
      {renderWords(line, currentTime)}
    </motion.div>
  );
}

/* ---------- Smooth Blur & Fade (sinematik) ---------- */
function BlurFadeLine({
  line,
  currentTime,
}: {
  line: ParsedLrcLine;
  currentTime: number;
}) {
  return (
    <motion.div
      initial={{ y: 24, opacity: 0, filter: "blur(12px)" }}
      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
      exit={{ y: -24, opacity: 0, filter: "blur(12px)" }}
      transition={{
        duration: 0.9,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="text-center font-sans text-3xl sm:text-5xl md:text-6xl font-semibold leading-tight tracking-tight"
    >
      {renderWords(line, currentTime)}
    </motion.div>
  );
}

/* Utility memo untuk konsumsi currentTime tanpa re-render seluruh tree. */
export function useActiveWordCount(line?: ParsedLrcLine) {
  return useMemo(() => (line ? line.words.length : 0), [line]);
}
