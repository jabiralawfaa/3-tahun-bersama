"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ImagePlus, Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import {
  MEDIA_MAX_BYTES,
  cleanMediaName,
  formatKB,
  prepareImage,
  type MediaItem,
} from "@/lib/media";

/**
 * MediaManager — pustaka gambar (menu "Media" di dashboard).
 * ------------------------------------------------------------------
 * Satu-satunya tempat mengunggah gambar. Unggah sebanyak mungkin, beri
 * nama, ganti nama, atau hapus. Gambar yang sudah ada dipilih per baris
 * lewat dropdown di bagian refleksi/preset tiap baris pada form entri.
 * ------------------------------------------------------------------ */
interface PendingFile {
  key: string;
  file: File;
  name: string;
  preview: string;
}

export function MediaManager({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<PendingFile[]>([]);
  pendingRef.current = pending;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      setItems(data.media ?? []);
    } catch (e) {
      setError(`Gagal memuat daftar media: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Lepas object URL pratinjau saat ditutup.
  useEffect(
    () => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.preview)),
    [],
  );

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError("");
    const next: PendingFile[] = [];
    for (const f of Array.from(list)) {
      // Jangan tolak berdasarkan MIME saja: foto ponsel (HEIC/HEIF) dan berkas
      // tanpa MIME tetap diterima selama browser bisa mengurainya, lalu
      // diubah ke WebP oleh prepareImage.
      if (f.type && !f.type.startsWith("image/")) {
        setError(`"${f.name}" dilewati: bukan berkas gambar.`);
        continue;
      }
      next.push({
        key: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        name: cleanMediaName(f.name.replace(/\.[^.]+$/, "")),
        preview: URL.createObjectURL(f),
      });
    }
    setPending((p) => [...p, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePending = (key: string) =>
    setPending((p) => {
      const hit = p.find((x) => x.key === key);
      if (hit) URL.revokeObjectURL(hit.preview);
      return p.filter((x) => x.key !== key);
    });

  const uploadAll = async () => {
    if (!pending.length || uploading) return;
    if (pending.some((p) => !cleanMediaName(p.name))) {
      setError("Semua gambar harus diberi nama.");
      return;
    }
    setUploading(true);
    setError("");
    const failed: string[] = [];
    const queue = [...pending];
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      setProgress(`Mengunggah ${i + 1}/${queue.length}: ${p.name}`);
      try {
        const prepared = await prepareImage(p.file);
        if (prepared.blob.size > MEDIA_MAX_BYTES) {
          throw new Error("masih > 4 MB setelah dikompres");
        }
        const fd = new FormData();
        fd.append(
          "file",
          new File([prepared.blob], p.file.name, { type: prepared.mime }),
        );
        fd.append("name", cleanMediaName(p.name));
        fd.append("width", String(prepared.width));
        fd.append("height", String(prepared.height));
        const res = await fetch("/api/media", { method: "POST", body: fd, credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
        setItems((cur) => [data.media as MediaItem, ...cur]);
        removePending(p.key);
      } catch (e) {
        failed.push(`${p.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setProgress("");
    setUploading(false);
    if (failed.length) setError(`Gagal: ${failed.join("; ")}`);
  };

  const saveRename = async (id: string) => {
    const name = cleanMediaName(editName);
    if (!name) return;
    setError("");
    const res = await fetch(`/api/media/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || `Gagal mengganti nama: HTTP ${res.status} ${res.statusText}`);
      return;
    }
    setItems((cur) => cur.map((m) => (m.id === id ? { ...m, name } : m)));
    setEditingId(null);
  };

  const remove = async (m: MediaItem) => {
    if (!window.confirm(`Hapus gambar "${m.name}" dari Media?`)) return;
    setError("");
    setDeleting(m.id);
    try {
      const del = (force: boolean) =>
        fetch(`/api/media/${m.id}${force ? "?force=1" : ""}`, {
          method: "DELETE",
          credentials: "include",
        });

      let res = await del(false);
      let data = await res.json().catch(() => ({}));

      // Gambar masih dipakai baris entri lain: tawarkan hapus paksa yang
      // sekaligus melepasnya dari baris-baris tersebut.
      if (res.status === 409) {
        const usedBy: string[] = Array.isArray(data.usedBy) ? data.usedBy : [];
        const lanjut = window.confirm(
          `Gambar "${m.name}" masih dipakai oleh: ${usedBy.join(", ") || "entri lain"}.\n\nHapus tetap? Gambar akan dilepas dari baris yang memakainya dan URL-nya tidak lagi tampil di halaman arsip.`,
        );
        if (!lanjut) return;
        res = await del(true);
        data = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        setError(data.error || `Gagal menghapus: HTTP ${res.status} ${res.statusText}`);
        return;
      }
      setItems((cur) => cur.filter((x) => x.id !== m.id));
    } finally {
      setDeleting(null);
    }
  };

  const inputCls =
    "w-full rounded border border-white/10 bg-midnight/60 px-2 py-1.5 text-sm text-foreground outline-none focus:border-amber-warm/40";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-midnight-deep/85 px-4 py-8 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-4xl rounded-xl border border-white/10 bg-midnight p-5 sm:p-6"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
              pustaka gambar
            </p>
            <h2 className="text-lg font-semibold tracking-tight">Media</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Unggah gambar di sini, lalu pilih per baris lewat dropdown
              &ldquo;gambar&rdquo; di bagian refleksi pada form arsip. Gambar
              otomatis diperkecil (maks. 1600 px) agar ringan. Mode ramai
              memakai foto acak dari pustaka ini. Hapus gambar lewat ikon
              tempat sampah pada kartu — gambar yang masih dipakai baris akan
              ditawari hapus paksa (referensinya dilepas otomatis).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Area unggah */}
        <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-4">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-warm/20 px-4 py-2 font-mono text-xs uppercase tracking-wider text-amber-warm transition-colors hover:bg-amber-warm/30 disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" /> Pilih gambar (bisa banyak)
          </button>

          {pending.length > 0 && (
            <>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {pending.map((p) => (
                  <li
                    key={p.key}
                    className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.preview}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <input
                        className={inputCls}
                        value={p.name}
                        maxLength={60}
                        disabled={uploading}
                        placeholder="Nama gambar"
                        onChange={(e) =>
                          setPending((cur) =>
                            cur.map((x) =>
                              x.key === p.key ? { ...x, name: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
                        {formatKB(p.file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => removePending(p.key)}
                      aria-label="Batalkan"
                      className="rounded p-1.5 text-muted-foreground hover:text-rose-warm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={uploadAll}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-warm px-4 py-2 font-mono text-xs uppercase tracking-wider text-midnight-deep transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Unggah {pending.length} gambar
                </button>
                {progress && (
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {progress}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-warm/30 bg-rose-warm/10 px-3 py-2 text-xs text-rose-warm">
            {error}
          </p>
        )}

        {/* Daftar */}
        <p className="mb-3 mt-6 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {loading ? "memuat…" : `${items.length} gambar`}
        </p>
        {!loading && items.length === 0 && (
          <p className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
            Belum ada gambar. Klik &ldquo;Pilih gambar&rdquo; untuk memulai.
          </p>
        )}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <li
              key={m.id}
              className="overflow-hidden rounded-lg border border-white/8 bg-white/[0.02]"
            >
              <div className="aspect-square bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt={m.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-2">
                {editingId === m.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      className={inputCls}
                      value={editName}
                      maxLength={60}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(m.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => saveRename(m.id)}
                      aria-label="Simpan nama"
                      className="rounded p-1 text-amber-warm hover:bg-amber-warm/15"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="truncate text-sm" title={m.name}>
                    {m.name}
                  </p>
                )}
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {m.width && m.height ? `${m.width}×${m.height} · ` : ""}
                    {formatKB(m.size)}
                  </span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(m.id);
                        setEditName(m.name);
                      }}
                      aria-label={`Ganti nama ${m.name}`}
                      className="rounded p-1 text-muted-foreground hover:text-amber-warm"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={deleting === m.id}
                      onClick={() => remove(m)}
                      aria-label={`Hapus ${m.name}`}
                      className="rounded p-1 text-muted-foreground hover:text-rose-warm disabled:opacity-50"
                    >
                      {deleting === m.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}
