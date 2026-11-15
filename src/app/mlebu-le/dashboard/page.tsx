"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  LogOut,
  Pencil,
  Trash2,
  Music2,
  RefreshCw,
} from "lucide-react";
import type { Memory } from "@/data/memories";
import { MemoryForm } from "./MemoryForm";

/**
 * Dashboard Admin (`/mlebu-le/dashboard`)
 * ------------------------------------------------------------------
 * Daftar entri arsip + tambah/edit/hapus. Dilindungi middleware.
 * ------------------------------------------------------------------
 */
export default function DashboardPage() {
  const router = useRouter();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Memory | null>(null);

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memories");
      if (res.status === 401) {
        router.replace("/mlebu-le?next=/mlebu-le/dashboard");
        return;
      }
      const data = await res.json();
      setMemories(data.memories ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleSave = useCallback(
    async (form: FormData) => {
      const isEdit = !!editing;
      const url = isEdit
        ? `/api/memories/${editing!.id}`
        : "/api/memories";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan.");
      }
      setEditing(null);
      setCreating(false);
      await fetchMemories();
    },
    [editing, fetchMemories],
  );

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    const res = await fetch(`/api/memories/${confirmDelete.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setConfirmDelete(null);
      await fetchMemories();
    }
  }, [confirmDelete, fetchMemories]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/mlebu-le");
  }, [router]);

  return (
    <main className="relative min-h-screen flex flex-col bg-midnight-deep">
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-60" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 glow-amber opacity-50"
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-4 border-b border-white/8">
        <div className="flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-warm/80" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
              admin dashboard
            </p>
            <h1 className="text-lg font-semibold tracking-tight">
              Arsip 3 Tahun — Panel
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchMemories}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Keluar
          </button>
        </div>
      </header>

      {/* Konten */}
      <section className="relative z-10 flex-1 px-5 sm:px-8 py-6">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {loading
              ? "memuat…"
              : `${memories.length} entri arsip`}
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-warm/20 px-4 py-2 font-mono text-xs uppercase tracking-wider text-amber-warm transition-colors hover:bg-amber-warm/30"
          >
            <Plus className="h-4 w-4" /> Tambah Arsip
          </button>
        </div>

        {/* Grid entri */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-xl border border-white/8 bg-white/[0.02]"
              />
            ))}
          </div>
        ) : memories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada entri arsip. Klik{" "}
              <span className="text-amber-warm">Tambah Arsip</span> untuk
              membuat yang pertama.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memories.map((m) => (
              <motion.div
                key={m.id}
                layout
                className="group relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-amber-warm/30"
                style={{ ["--amber-warm" as string]: m.theme.accent } as React.CSSProperties}
              >
                {/* strip aksen atas */}
                <div
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{
                    background: `linear-gradient(90deg, ${m.theme.accent}, ${m.theme.accentSoft})`,
                  }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">
                      {m.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      code: {m.code} · /for/{m.slug}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <span
                      className="h-5 w-5 rounded-full border border-white/20"
                      style={{ backgroundColor: m.theme.accent }}
                      title={`Aksen: ${m.theme.accent}`}
                    />
                    <span
                      className="h-5 w-5 rounded-full border border-white/20"
                      style={{ backgroundColor: m.theme.accentSoft }}
                      title={`Sekunder: ${m.theme.accentSoft}`}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Music2 className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {m.songTitle} — {m.songArtist}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  <span>{m.lineConfig.length} refleksi</span>
                  <span className="opacity-40">·</span>
                  <span>{m.theme.decoration}</span>
                </div>
                {/* Aksi */}
                <div className="mt-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setEditing(m)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-warm transition-colors hover:bg-amber-warm/15"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(m)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-rose-warm transition-colors hover:bg-rose-warm/15"
                  >
                    <Trash2 className="h-3 w-3" /> Hapus
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <footer className="relative z-10 mt-auto px-5 sm:px-8 py-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50 border-t border-white/8">
        <div className="flex items-center justify-between">
          <span>arsip-3-tahun · admin panel</span>
          <a href="/" className="hover:text-foreground transition-colors">
            ← lihat gerbang
          </a>
        </div>
      </footer>

      {/* Form tambah/edit */}
      <AnimatePresence>
        {(creating || editing) && (
          <MemoryForm
            initial={editing}
            onSave={handleSave}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Konfirmasi hapus */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-deep/80 backdrop-blur-sm px-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              className="w-full max-w-sm rounded-xl border border-white/10 bg-midnight p-6"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">Hapus arsip?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Entri untuk{" "}
                <span className="text-foreground">{confirmDelete.name}</span>{" "}
                (code: {confirmDelete.code}) akan dihapus permanen beserta file
                audionya.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-warm/20 px-4 py-2 font-mono text-xs uppercase tracking-wider text-rose-warm hover:bg-rose-warm/30"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
