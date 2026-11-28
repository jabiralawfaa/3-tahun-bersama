"use client";

import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

/**
 * FinalConfession
 * ------------------------------------------------------------------
 * Adegan penutup sinematik yang muncul setelah lagu & animasi selesai.
 *
 * - Reveal bertahap per frasa (staggered, blur-to-clear) dengan jeda
 *   dramatis yang lembut.
 * - Bingkai selection-frame bersih + label monospace di sudut atas.
 * - Setelah pesan tampil penuh, muncul tombol kecil Replay / Beranda.
 * ------------------------------------------------------------------
 */
interface FinalConfessionProps {
  message: string;
  frameLabel: string;
  onReplay: () => void;
}

export function FinalConfession({
  message,
  frameLabel,
  onReplay,
}: FinalConfessionProps) {
  const router = useRouter();
  const reset = useAuthStore((s) => s.reset);

  // Pecah pesan menjadi frasa-frasa untuk staggered reveal.
  const phrases = splitToPhrases(message);

  const goHome = () => {
    reset();
    router.push("/");
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-center justify-center px-5 sm:px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Latar redup sinematik */}
        <motion.div
          className="absolute inset-0 bg-midnight-deep/70 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />

        {/* Aura hangat di belakang kalimat */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 glow-amber"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.5, scale: 1 }}
          transition={{ duration: 2.4, ease: "easeOut", delay: 0.4 }}
        />

        {/* Frame pesan utama */}
        <motion.div
          className="selection-frame relative w-full max-w-3xl rounded-2xl border border-amber-warm/20 bg-white/[0.02] px-6 py-12 sm:px-12 sm:py-16 backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
        >
          {/* Label monospace sudut atas ala editor */}
          <div className="absolute -top-3 left-6 rounded-full border border-amber-warm/30 bg-midnight px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-warm/80">
            {frameLabel}
          </div>
          <div className="absolute -top-3 right-6 rounded-full border border-white/10 bg-midnight px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
            3_Years_Summary
          </div>

          {/* Pesan — staggered reveal per frasa */}
          <h2 className="text-center font-sans text-2xl sm:text-4xl md:text-5xl font-semibold leading-[1.25] tracking-tight">
            {phrases.map((phrase, i) => (
              <motion.span
                key={i}
                className="inline-block"
                initial={{ opacity: 0, y: 14, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  duration: 1.1,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 1.2 + i * 0.55,
                }}
              >
                <span
                  className={
                    // Frasa terakhir diberi aksen hangat
                    i === phrases.length - 1
                      ? "text-warm-gradient"
                      : "text-foreground"
                  }
                >
                  {phrase}
                </span>
                {i < phrases.length - 1 ? " " : ""}
              </motion.span>
            ))}
          </h2>

          {/* Garis pemisah editorial */}
          <motion.div
            className="mx-auto mt-10 h-px w-24 bg-gradient-to-r from-transparent via-amber-warm/40 to-transparent"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 1, delay: 1.4 + phrases.length * 0.55 }}
          />

          {/* Subteks kecil */}
          <motion.p
            className="mt-5 text-center font-serif italic text-sm sm:text-base text-muted-foreground/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.8 + phrases.length * 0.55 }}
          >
            — ditulis dalam diam, ungkapan selama ini.
          </motion.p>

          {/* Tombol kecil Replay / Beranda */}
          <motion.div
            className="mt-10 flex items-center justify-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              delay: 2.6 + phrases.length * 0.55,
            }}
          >
            <button
              type="button"
              onClick={onReplay}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-warm/30 bg-amber-warm/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-amber-warm transition-colors hover:bg-amber-warm/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Replay
            </button>
            <button
              type="button"
              onClick={goHome}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
            >
              <Home className="h-3.5 w-3.5" />
              Beranda
            </button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Pecah pesan menjadi frasa-frasa untuk reveal bertahap. */
function splitToPhrases(message: string): string[] {
  // Pisahkan berdasarkan koma, lalu rapikan.
  const parts = message
    .split(/(?<=[,])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return [message];
  return parts;
}
