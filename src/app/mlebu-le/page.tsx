"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ArrowRight, CornerDownLeft, Eye, EyeOff } from "lucide-react";

/**
 * Halaman Login Tersembunyi (`/mlebu-le`)
 * ------------------------------------------------------------------
 * "mlebu-le" = masuk-masuk (Javanese slang). Rute unik, tidak terlink
 * dari mana pun. Setelah login valid → redirect ke /mlebu-le/dashboard.
 * ------------------------------------------------------------------
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/mlebu-le/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [booted, setBooted] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setBooted(true);
      userRef.current?.focus();
    }, 250);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Username dan password wajib diisi.");
      setShakeKey((k) => k + 1);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kredensial salah.");
        setShakeKey((k) => k + 1);
        setLoading(false);
        return;
      }
      router.push(next);
    } catch {
      setError("Sambungan terputus. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <Suspense fallback={<Loading />}>
      <main className="relative min-h-screen flex flex-col overflow-hidden bg-dot-grid">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: booted ? 1 : 0 }}
          transition={{ duration: 1 }}
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

        <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-warm/80" />
            <span>mlebu-le</span>
            <span className="hidden sm:inline opacity-40">/</span>
            <span className="hidden sm:inline opacity-60">admin-gateway</span>
          </div>
          <a
            href="/"
            className="opacity-70 hover:opacity-100 transition-opacity"
          >
            ← kembali
          </a>
        </header>

        <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key="login"
              className="w-full max-w-md"
              initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={
                booted
                  ? { opacity: 1, y: 0, filter: "blur(0px)" }
                  : { opacity: 0, y: 18, filter: "blur(8px)" }
              }
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-2 mb-5 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-warm" />
                <span>admin · classified</span>
              </div>

              <h1 className="font-sans text-3xl sm:text-4xl font-semibold leading-[1.05] tracking-tight text-foreground">
                Masuk ke{" "}
                <span className="text-warm-gradient">panel arsip</span>.
              </h1>
              <p className="mt-3 text-sm text-muted-foreground/90">
                Kelola kode nama, lagu, lirik, dan pesan penutup untuk setiap
                orang di arsip kenangan.
              </p>

              <motion.form
                key={`shake-${shakeKey}`}
                onSubmit={handleSubmit}
                className={shakeKey ? "animate-micro-shake" : ""}
                initial={false}
              >
                <div className="mt-6 space-y-3">
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                      username
                    </span>
                    <div className="selection-frame mt-1.5 flex items-center rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 focus-within:border-amber-warm/40">
                      <input
                        ref={userRef}
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        className="flex-1 bg-transparent text-sm text-foreground outline-none font-sans"
                        aria-label="Username admin"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                      password
                    </span>
                    <div className="selection-frame mt-1.5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 focus-within:border-amber-warm/40">
                      <input
                        type={showPass ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="off"
                        className="flex-1 bg-transparent text-sm text-foreground outline-none font-sans"
                        aria-label="Password admin"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((s) => !s)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
                      >
                        {showPass ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </label>
                </div>

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
                  disabled={loading}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-warm/15 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-amber-warm transition-colors hover:bg-amber-warm/25 disabled:opacity-50"
                >
                  {loading ? "Memeriksa…" : "Masuk"}
                  {!loading && <CornerDownLeft className="h-3.5 w-3.5" />}
                  {loading && <ArrowRight className="h-3.5 w-3.5 animate-pulse" />}
                </button>
              </motion.form>
            </motion.div>
          </AnimatePresence>
        </section>

        <footer className="relative z-10 mt-auto px-5 sm:px-8 py-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">
          <div className="flex items-center justify-between">
            <span>arsip-3-tahun · admin</span>
            <span className="hidden sm:inline">restricted area</span>
          </div>
        </footer>
      </main>
    </Suspense>
  );
}
