"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, ArrowRight, CornerDownLeft, Lock } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";

/**
 * Halaman Gerbang (`/`)
 * ------------------------------------------------------------------
 * Autentikasi "Kode Nama / Passcode" rahasia (validasi client-side).
 * Estetika command palette (Spotlight / Figma Quick Actions).
 *
 * Mikro-interaksi:
 *  - shake halus jika kode salah
 *  - transisi fade/scale mulus jika kode benar
 *  - pemicu user gesture agar audio bisa autoplay di halaman berikutnya
 * ------------------------------------------------------------------
 */
export default function GatewayPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [unlocking, setUnlocking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [booted, setBooted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const unlock = useAuthStore((s) => s.unlock);

  useEffect(() => {
    const t = setTimeout(() => {
      setBooted(true);
      inputRef.current?.focus();
    }, 350);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const code = value.trim();
      if (!code) return;
      setChecking(true);
      try {
        const res = await fetch("/api/validate-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (!data.ok || !data.slug) {
          setError("Kode nama tidak dikenali. Coba sekali lagi.");
          setShakeKey((k) => k + 1);
          setValue("");
          setChecking(false);
          setTimeout(() => inputRef.current?.focus(), 50);
          return;
        }
        // Kode benar — buka kunci + pemicu gesture audio.
        setError(null);
        unlock(data.slug);
        setUnlocking(true);
        setTimeout(() => {
          router.push(`/for/${data.slug}`);
        }, 900);
      } catch {
        setError("Sambungan terputus. Coba lagi.");
        setChecking(false);
      }
    },
    [value, unlock, router],
  );

  return (
    <main className="relative min-h-screen flex flex-col overflow-hidden bg-dot-grid">
      {/* Ambient warm glows yang bergerak perlahan */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: bootingOpacity(booted) }}
        transition={{ duration: 1.2 }}
      >
        <motion.div
          className="absolute -top-40 -left-32 h-[42rem] w-[42rem] glow-amber"
          animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-52 -right-32 h-[44rem] w-[44rem] glow-rose"
          animate={{ x: [0, -36, 0], y: [0, -28, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Header bar ala editor */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-warm/80" />
          <span>ungkapan-selama-ini</span>
          <span className="hidden sm:inline opacity-40">/</span>
          <span className="hidden sm:inline opacity-60">gateway.tsx</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 opacity-70">
          <span>class-of-2022—2025</span>
          <span className="opacity-40">·</span>
          <span>exit: esc</span>
        </div>
      </header>

      {/* Konten utama */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-8">
        <AnimatePresence mode="wait">
          {!unlocking ? (
            <motion.div
              key="gate"
              className="w-full max-w-xl"
              initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={
                booted
                  ? { opacity: 1, y: 0, filter: "blur(0px)" }
                  : { opacity: 0, y: 18, filter: "blur(8px)" }
              }
              exit={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Label kecil */}
              <div className="flex items-center gap-2 mb-5 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
                <Lock className="h-3.5 w-3.5 text-amber-warm" />
                <span>passcode · classified</span>
              </div>

              <h1 className="font-sans text-3xl sm:text-5xl font-semibold leading-[1.05] tracking-tight text-foreground">
                Buka{" "}
                <span className="text-warm-gradient">ungkapan selama ini</span>
                <br className="hidden sm:block" /> dengan kode namamu.
              </h1>

              <p className="mt-4 max-w-md text-sm sm:text-base text-muted-foreground/90 leading-relaxed">
                Sebuah halaman pribadi yang hanya bisa dibuka oleh orang yang
                tepat. Ketik kode namamu di bawah ini — pelan-pelan, seperti
                menulis surat.
              </p>

              {/* Command palette */}
              <motion.form
                key={`shake-${shakeKey}`}
                onSubmit={handleSubmit}
                className={shakeKey ? "animate-micro-shake" : ""}
                initial={false}
              >
                <div className="selection-frame group relative mt-7 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 sm:px-5 py-3.5 backdrop-blur-md transition-colors focus-within:border-amber-warm/40 focus-within:bg-white/[0.05]">
                  <Terminal className="h-4.5 w-4.5 shrink-0 text-amber-warm/80" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => {
                      setValue(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Masukkan kode namamu untuk membuka ungkapan selama ini..."
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="flex-1 bg-transparent text-base sm:text-lg text-foreground placeholder:text-muted-foreground/50 outline-none font-sans tracking-tight"
                    aria-label="Kode nama rahasia"
                  />
                  <kbd className="hidden sm:inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    <CornerDownLeft className="h-3 w-3" /> enter
                  </kbd>
                </div>

                {/* Pesan error */}
                <div className="mt-3 h-5 font-mono text-xs text-rose-warm/90">
                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.span
                        key={error}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="inline-flex items-center gap-1.5"
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-warm/80" />
                        {error}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="submit"
                  disabled={checking}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-warm/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-amber-warm transition-colors hover:bg-amber-warm/25 disabled:opacity-50"
                >
                  {checking ? "Memeriksa…" : "Buka arsip"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </motion.form>

              {/* Hint kecil */}
              <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40">
                hint · kode ini bukan namamu yang biasa
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="unlocking"
              className="text-center"
              initial={{ opacity: 0, scale: 0.92, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-amber-warm/30 bg-amber-warm/10"
                animate={{ boxShadow: [
                  "0 0 0 0 rgba(120,80,40,0.0)",
                  "0 0 30px 6px rgba(180,140,70,0.25)",
                  "0 0 0 0 rgba(120,80,40,0.0)",
                ] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                <Lock className="h-6 w-6 text-amber-warm" />
              </motion.div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-warm/90">
                unlocking archive…
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Menyiapkan kinetic lyrics &amp; pengakuan pribadi.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Footer sticky */}
      <footer className="relative z-10 mt-auto px-5 sm:px-8 py-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
          <span>3-years-archive · personal confession edition</span>
          <span>made with framer-motion · design canvas aesthetic</span>
        </div>
      </footer>
    </main>
  );
}

function bootingOpacity(booted: boolean) {
  return booted ? 1 : 0;
}
