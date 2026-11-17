"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Save, X, Upload, Music2, FileText, Palette, Sparkles } from "lucide-react";
import {
  parseEnhancedLrc,
  type ParsedLrcLine,
} from "@/lib/lrc";
import {
  ANIMATION_PRESETS,
  DECORATION_KINDS,
  MEMORY_DEFAULTS,
  getMode,
  type LineConfig,
  type Memory,
  type MemoryMode,
} from "@/data/memories";

/**
 * MemoryForm
 * ------------------------------------------------------------------
 * Form tambah/edit entri arsip. Fitur:
 *  - Upload lagu MP3 + LRC (LRC wajib)
 *  - Saat LRC diisi, otomatis generate baris refleksi per baris lirik
 *    (jumlah menyesuaikan jumlah baris LRC). Refleksi lama dipertahankan
 *    untuk indeks yang cocok.
 *  - Pemilih warna aksen per-orang (hex + color picker) + preview live
 *  - Pesan penutup + label frame
 * ------------------------------------------------------------------
 */
interface MemoryFormProps {
  initial?: Memory | null;
  onSave: (form: FormData) => Promise<void>;
  onCancel: () => void;
}

const DEFAULT_FORM = {
  name: "",
  code: "",
  slug: "",
  role: MEMORY_DEFAULTS.role,
  themeLabel: MEMORY_DEFAULTS.themeLabel,
  accent: MEMORY_DEFAULTS.accent,
  accentSoft: MEMORY_DEFAULTS.accentSoft,
  background: MEMORY_DEFAULTS.background,
  decoration: MEMORY_DEFAULTS.decoration,
  songTitle: "",
  songArtist: "",
  finalMessage: "",
  finalFrameLabel: MEMORY_DEFAULTS.finalFrameLabel,
  enhancedLrc: "",
};

export function MemoryForm({ initial, onSave, onCancel }: MemoryFormProps) {
  const [form, setForm] = useState(() => ({
    ...DEFAULT_FORM,
    ...(initial
      ? {
          name: initial.name,
          code: initial.code,
          slug: initial.slug,
          role: initial.role,
          themeLabel: initial.theme.label,
          accent: initial.theme.accent,
          accentSoft: initial.theme.accentSoft,
          background: initial.theme.background,
          decoration: initial.theme.decoration,
          songTitle: initial.songTitle,
          songArtist: initial.songArtist,
          finalMessage: initial.finalMessage,
          finalFrameLabel: initial.finalFrameLabel,
          enhancedLrc: initial.enhancedLrc,
        }
      : {}),
  }));
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lrcFileName, setLrcFileName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existingAudio = initial?.audioSrc ?? "";
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);

  // Mode tampilan: "lrc" (lirik ter-sync) atau "plain" (ucapan biasa).
  const [mode, setMode] = useState<MemoryMode>(
    initial ? getMode(initial) : "lrc",
  );
  // Teks ucapan per baris (mode plain) — satu ucapan per baris.
  const [plainText, setPlainText] = useState<string>(
    initial?.plainLines?.join("\n") ?? "",
  );

  // State lineConfig — refleksi/preset per baris.
  const [lineConfig, setLineConfig] = useState<LineConfig[]>(
    initial?.lineConfig ?? [],
  );

  // Daftar baris sesuai mode (untuk konteks + auto-generate lineConfig).
  const parsedLines: ParsedLrcLine[] = useMemo(
    () => (mode === "lrc" ? parseEnhancedLrc(form.enhancedLrc, []) : []),
    [form.enhancedLrc, mode],
  );
  const plainArr: string[] = useMemo(
    () =>
      mode === "plain"
        ? plainText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    [plainText, mode],
  );
  // Jumlah baris aktif sesuai mode.
  const lineCount = mode === "lrc" ? parsedLines.length : plainArr.length;
  // Teks konteks per baris (lirik di mode LRC, ucapan di mode plain).
  const lineTextAt = (i: number): string =>
    mode === "lrc" ? parsedLines[i]?.text ?? "" : plainArr[i] ?? "";

  // Sinkronkan jumlah baris lineConfig dengan jumlah baris aktif.
  // Pertahankan refleksi/preset lama untuk indeks yang cocok.
  useEffect(() => {
    if (lineCount === 0) return;
    setLineConfig((prev) => {
      const presets = ANIMATION_PRESETS;
      const next: LineConfig[] = Array.from({ length: lineCount }, (_, i) => {
        const old = prev[i];
        if (old) return old;
        return {
          reflection: "",
          animationPreset: presets[i % presets.length],
        };
      });
      return next.length === prev.length &&
        next.every((v, i) => v === prev[i])
        ? prev
        : next;
    });
  }, [lineCount]);

  const set = useCallback(
    (key: keyof typeof form, value: string) =>
      setForm((f) => ({ ...f, [key]: value })),
    [],
  );

  const handleAudioFile = (file: File | null) => {
    setAudioFile(file);
  };

  const handleLrcFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    set("enhancedLrc", text);
    setLrcFileName(file.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.code.trim()) {
      setError("Nama dan kode nama wajib diisi.");
      return;
    }
    // Validasi konten sesuai mode.
    const hasLrc = mode === "lrc" && form.enhancedLrc.trim().length > 0;
    const hasPlain = mode === "plain" && plainArr.length > 0;
    if (!hasLrc && !hasPlain) {
      setError(
        mode === "lrc"
          ? "LRC wajib diisi (atau ganti ke mode Tulisan Biasa)."
          : "Tulis minimal satu ucapan per baris.",
      );
      return;
    }
    if (!audioFile && !existingAudio) {
      setError("File audio MP3 wajib diupload.");
      return;
    }

    const fd = new FormData();
    fd.append("name", form.name.trim());
    fd.append("code", form.code.trim());
    fd.append("slug", form.slug.trim() || form.code.trim());
    fd.append("role", form.role);
    fd.append("themeLabel", form.themeLabel);
    fd.append("accent", form.accent);
    fd.append("accentSoft", form.accentSoft);
    fd.append("background", form.background);
    fd.append("decoration", form.decoration);
    fd.append("songTitle", form.songTitle || form.name);
    fd.append("songArtist", form.songArtist);
    // Kirim konten sesuai mode; field mode lain dikosongkan agar tidak ambigu.
    fd.append("enhancedLrc", mode === "lrc" ? form.enhancedLrc : "");
    fd.append(
      "plainLines",
      JSON.stringify(mode === "plain" ? plainArr : []),
    );
    fd.append("lineConfig", JSON.stringify(lineConfig));
    fd.append("finalMessage", form.finalMessage);
    fd.append("finalFrameLabel", form.finalFrameLabel);
    if (existingAudio) fd.append("audioSrc", existingAudio);
    if (audioFile) fd.append("audioFile", audioFile);

    setSaving(true);
    try {
      await onSave(fd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto bg-midnight-deep/95 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="mx-auto max-w-3xl px-5 sm:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-warm/80">
              {initial ? "edit entry" : "new entry"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {initial ? `Edit — ${initial.name}` : "Tambah arsip baru"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section: Identitas */}
          <Section icon={<Sparkles className="h-4 w-4" />} title="Identitas">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nama Tampilan">
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Mis. Starla"
                />
              </Field>
              <Field label="Kode Nama (namecode)">
                <input
                  className={inputCls}
                  value={form.code}
                  onChange={(e) => set("code", e.target.value)}
                  placeholder="Mis. starla — diketik di gerbang"
                />
              </Field>
              <Field label="Slug URL (opsional, default = kode)">
                <input
                  className={inputCls}
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder="/for/[slug]"
                />
              </Field>
              <Field label="Peran / Identitas">
                <input
                  className={inputCls}
                  value={form.role}
                  onChange={(e) => set("role", e.target.value)}
                  placeholder="Mis. Mahasiswa IT & UI/UX Designer"
                />
              </Field>
            </div>
          </Section>

          {/* Section: Lagu */}
          <Section icon={<Music2 className="h-4 w-4" />} title="Lagu">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Judul Lagu">
                <input
                  className={inputCls}
                  value={form.songTitle}
                  onChange={(e) => set("songTitle", e.target.value)}
                  placeholder="Mis. Surat Cinta untuk Starla"
                />
              </Field>
              <Field label="Artis">
                <input
                  className={inputCls}
                  value={form.songArtist}
                  onChange={(e) => set("songArtist", e.target.value)}
                  placeholder="Mis. Virgoun"
                />
              </Field>
            </div>
            <Field label="File Audio MP3" className="mt-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/mpeg,audio/mp3,.mp3"
                  onChange={(e) => handleAudioFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-mono uppercase tracking-wider text-amber-warm transition-colors hover:bg-white/[0.07]"
                >
                  <Upload className="h-3.5 w-3.5" /> Pilih MP3
                </button>
                {audioFile ? (
                  <span className="text-xs text-foreground/80">
                    {audioFile.name}{" "}
                    <span className="text-muted-foreground">
                      ({Math.round(audioFile.size / 1024)} KB)
                    </span>
                  </span>
                ) : existingAudio ? (
                  <span className="text-xs text-muted-foreground">
                    Saat ini: {existingAudio}{" "}
                    <span className="opacity-60">(biarkan kosong untuk pertahankan)</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/70">
                    Belum ada file
                  </span>
                )}
              </div>
            </Field>
          </Section>

          {/* Section: Lirik / Ucapan */}
          <Section
            icon={<FileText className="h-4 w-4" />}
            title="Lirik / Ucapan"
          >
            {/* Toggle mode */}
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode("lrc")}
                className={`rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  mode === "lrc"
                    ? "bg-amber-warm/20 text-amber-warm"
                    : "border border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.07]"
                }`}
              >
                Lirik (LRC)
              </button>
              <button
                type="button"
                onClick={() => setMode("plain")}
                className={`rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  mode === "plain"
                    ? "bg-amber-warm/20 text-amber-warm"
                    : "border border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.07]"
                }`}
              >
                Tulisan Biasa
              </button>
            </div>

            {mode === "lrc" ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">
                    Tempel LRC, atau upload file{" "}
                    <code className="font-mono text-amber-warm/80">.lrc</code>.
                    Format:{" "}
                    <code className="font-mono text-[10px]">
                      [mm:ss.xx]&lt;mm:ss.xx&gt;kata
                    </code>
                  </p>
                  <input
                    ref={lrcInputRef}
                    type="file"
                    accept=".lrc,text/plain"
                    onChange={(e) => handleLrcFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => lrcInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-amber-warm transition-colors hover:bg-white/[0.07]"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload .lrc
                  </button>
                </div>
                {lrcFileName && (
                  <p className="mb-2 text-xs text-amber-warm/70">
                    Dimuat dari: {lrcFileName}
                  </p>
                )}
                <textarea
                  className={`${inputCls} thin-scroll min-h-[140px] resize-y font-mono text-xs`}
                  value={form.enhancedLrc}
                  onChange={(e) => set("enhancedLrc", e.target.value)}
                  placeholder={"[00:00.75]<00:00.75>Bila <00:01.11>habis ..."}
                />
                {parsedLines.length > 0 && (
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    Terdeteksi {parsedLines.length} baris lirik → refleksi per
                    baris dibuat otomatis di bawah.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  Tulis ucapan per baris (satu ucapan per baris). Tanpa LRC —{" "}
                  <span className="text-amber-warm/80">
                    durasi lagu akan dibagi rata sesuai jumlah baris
                  </span>
                  , dan tulisan tampil sebagai ucapan biasa yang ditonjolkan
                  (tanpa highlight per kata).
                </p>
                <textarea
                  className={`${inputCls} thin-scroll min-h-[160px] resize-y`}
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  placeholder={
                    "Halo, ini ucapan pertama...\nIni ucapan kedua...\nIni ucapan ketiga..."
                  }
                />
                {plainArr.length > 0 && (
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    {plainArr.length} baris ucapan → preset animasi per baris
                    dibuat otomatis di bawah.
                  </p>
                )}
              </>
            )}
          </Section>

          {/* Section: Refleksi / Preset per baris (mode-aware) */}
          {lineCount > 0 && (
            <Section
              icon={<FileText className="h-4 w-4" />}
              title={
                mode === "lrc"
                  ? `Refleksi per Baris (${lineCount})`
                  : `Preset Animasi per Baris (${lineCount})`
              }
            >
              <p className="text-xs text-muted-foreground mb-3">
                {mode === "lrc"
                  ? "Teks refleksi/pengakuan pribadi yang muncul di bawah baris lirik saat diputar. Pilih preset animasi per baris."
                  : "Pilih preset animasi untuk tiap ucapan. Ucapan akan tampil sebagai hero utama (tanpa highlight per kata) bergantian selama durasi yang dibagi rata."}
              </p>
              <div className="space-y-3 thin-scroll max-h-[28rem] overflow-y-auto pr-1">
                {Array.from({ length: lineCount }, (_, i) => {
                  const ctx = lineTextAt(i);
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-white/5 bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-amber-warm/70">
                          baris {String(i + 1).padStart(2, "0")} ·{" "}
                          {ctx.slice(0, 40)}
                          {ctx.length > 40 ? "…" : ""}
                        </span>
                        <select
                          className="rounded border border-white/10 bg-midnight px-2 py-1 text-[11px] font-mono text-foreground outline-none focus:border-amber-warm/40"
                          value={lineConfig[i]?.animationPreset ?? "blur-fade"}
                          onChange={(e) =>
                            setLineConfig((prev) => {
                              const next = [...prev];
                              while (next.length <= i) {
                                next.push({
                                  reflection: "",
                                  animationPreset:
                                    ANIMATION_PRESETS[
                                      next.length % ANIMATION_PRESETS.length
                                    ],
                                });
                              }
                              next[i] = {
                                ...next[i],
                                animationPreset: e.target
                                  .value as LineConfig["animationPreset"],
                              };
                              return next;
                            })
                          }
                        >
                          {ANIMATION_PRESETS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* Refleksi hanya di mode LRC. Mode plain: ucapan sudah
                          jadi konten utama, tidak perlu subteks. */}
                      {mode === "lrc" && (
                        <textarea
                          className="thin-scroll w-full resize-y rounded border border-white/10 bg-midnight/60 px-3 py-2 text-sm text-foreground outline-none focus:border-amber-warm/40"
                          rows={2}
                          value={lineConfig[i]?.reflection ?? ""}
                          onChange={(e) =>
                            setLineConfig((prev) => {
                              const next = [...prev];
                              while (next.length <= i) {
                                next.push({
                                  reflection: "",
                                  animationPreset:
                                    ANIMATION_PRESETS[
                                      next.length % ANIMATION_PRESETS.length
                                    ],
                                });
                              }
                              next[i] = {
                                ...next[i],
                                reflection: e.target.value,
                              };
                              return next;
                            })
                          }
                          placeholder="Refleksi/pengakuan untuk baris ini…"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Section: Pesan Penutup */}
          <Section icon={<Sparkles className="h-4 w-4" />} title="Pesan Penutup">
            <div className="space-y-4">
              <Field label="Pesan akhir (muncul saat lagu selesai)">
                <textarea
                  className={`${inputCls} min-h-[80px] resize-y`}
                  value={form.finalMessage}
                  onChange={(e) => set("finalMessage", e.target.value)}
                  placeholder="Mis. Entah kamu sadar atau tidak, selama 3 tahun ini, aku mencintaimu"
                />
              </Field>
              <Field label="Label frame penutup (monospace)">
                <input
                  className={inputCls}
                  value={form.finalFrameLabel}
                  onChange={(e) => set("finalFrameLabel", e.target.value)}
                  placeholder="Final_Confession.tsx"
                />
              </Field>
            </div>
          </Section>

          {/* Section: Tema & Warna Aksen */}
          <Section icon={<Palette className="h-4 w-4" />} title="Tema & Warna Aksen">
            <p className="text-xs text-muted-foreground mb-3">
              Warna aksen per-orang. Pakai kode hex seperti{" "}
              <code className="font-mono text-amber-warm/80">#e8a23d</code>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ColorField
                label="Aksen Utama"
                value={form.accent}
                onChange={(v) => set("accent", v)}
              />
              <ColorField
                label="Aksen Sekunder"
                value={form.accentSoft}
                onChange={(v) => set("accentSoft", v)}
              />
              <ColorField
                label="Latar Canvas"
                value={form.background}
                onChange={(v) => set("background", v)}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Jenis Dekorasi SVG">
                <select
                  className={inputCls}
                  value={form.decoration}
                  onChange={(e) => set("decoration", e.target.value)}
                >
                  {DECORATION_KINDS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Label Tema">
                <input
                  className={inputCls}
                  value={form.themeLabel}
                  onChange={(e) => set("themeLabel", e.target.value)}
                />
              </Field>
            </div>
            {/* Preview live */}
            <div className="mt-4 rounded-lg border border-white/10 p-4"
              style={{
                backgroundColor: form.background,
                backgroundImage:
                  "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            >
              <p className="font-mono text-[10px] uppercase tracking-wider mb-2"
                style={{ color: form.accent }}
              >
                preview · live
              </p>
              <p className="text-lg font-semibold"
                style={{ color: "#f5f5f5" }}
              >
                Lirik{" "}
                <span style={{ color: form.accent }}>aktif</span>{" "}
                <span style={{ color: form.accentSoft }}>bercahaya</span>
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: "40%",
                    background: `linear-gradient(90deg, ${form.accent}, ${form.accentSoft})`,
                  }}
                />
              </div>
            </div>
          </Section>

          {/* Error + Actions */}
          {error && (
            <div className="rounded-lg border border-rose-warm/30 bg-rose-warm/10 px-4 py-3 font-mono text-xs text-rose-warm">
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pb-8">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-warm/20 px-5 py-2 font-mono text-xs uppercase tracking-wider text-amber-warm transition-colors hover:bg-amber-warm/30 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Menyimpan…" : initial ? "Simpan Perubahan" : "Buat Arsip"}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

/* ---------- sub-komponen ---------- */
const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-amber-warm/40";

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/8 bg-white/[0.015] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-amber-warm">{icon}</span>
        <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </span>
      {children}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
          aria-label={`${label} color picker`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} font-mono`}
          placeholder="#e8a23d"
        />
      </div>
    </Field>
  );
}
