"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Save, X, Upload, Music2, FileText, Palette, Sparkles, Shapes } from "lucide-react";
import {
  parseEnhancedLrc,
  type ParsedLrcLine,
} from "@/lib/lrc";
import {
  ANIMATION_PRESETS,
  DECORATION_INFO,
  DECORATION_KINDS,
  MEMORY_DEFAULTS,
  getMode,
  type DecorationKind,
  type IconLayout,
  type LineConfig,
  type Memory,
  type MemoryMode,
} from "@/data/memories";
import { ICON_NONE, parseSvg, type SvgIcon, type SvgNode } from "@/lib/svg";
import { SvgIconManager, validateIconsClient } from "./SvgIconManager";
import { AnimatedBackground } from "@/app/for/[slug]/components/AnimatedBackground";

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

  // Tata letak ikon pada mode tanpa LRC: "crowd" (ramai) / "single" (individual).
  const [iconLayout, setIconLayout] = useState<IconLayout>(
    initial?.iconLayout ?? "crowd",
  );

  // Pustaka ikon SVG animasi (muncul bergantian kiri/kanan tiap baris).
  const [svgIcons, setSvgIcons] = useState<SvgIcon[]>(initial?.svgIcons ?? []);

  // Saat ikon dihapus, lepas referensi iconId pada baris yang memakainya
  // (baris kembali ke mode otomatis).
  const handleIconsChange = useCallback((next: SvgIcon[]) => {
    setSvgIcons(next);
    const ids = new Set(next.map((i) => i.id));
    const stale = (c: LineConfig) =>
      (!!c.iconId && c.iconId !== ICON_NONE && !ids.has(c.iconId)) ||
      !!c.iconIds?.some((id) => !ids.has(id));
    setLineConfig((prev) =>
      prev.some(stale)
        ? prev.map((c) => {
            if (!stale(c)) return c;
            const keep = (c.iconIds ?? []).filter((id) => ids.has(id));
            return {
              ...c,
              iconIds: keep.length ? keep : undefined,
              iconId: keep[0],
            };
          })
        : prev,
    );
  }, []);

  // Ubah sebagian konfigurasi satu baris (mengisi baris kosong bila perlu).
  const patchLine = (i: number, patch: Partial<LineConfig>) =>
    setLineConfig((prev) => {
      const next = [...prev];
      while (next.length <= i) {
        next.push({
          reflection: "",
          animationPreset:
            ANIMATION_PRESETS[next.length % ANIMATION_PRESETS.length],
        });
      }
      next[i] = { ...next[i], ...patch };
      return next;
    });

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

    const iconErr = validateIconsClient(svgIcons);
    if (iconErr) {
      setError(iconErr);
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
    fd.append("svgIcons", JSON.stringify(svgIcons));
    fd.append("iconLayout", iconLayout);
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

          {/* Section: Ikon SVG animasi */}
          <Section
            icon={<Shapes className="h-4 w-4" />}
            title={`Ikon SVG Animasi (${svgIcons.length})`}
          >
            {mode === "plain" ? (
              <IconLayoutPicker value={iconLayout} onChange={setIconLayout} />
            ) : (
              <p className="mb-4 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground">
                Mode <span className="text-amber-warm/80">Lirik (LRC)</span>:
                ikon memakai grid 2 kolom (ikon separuh, teks separuh) dan
                bergantian kiri/kanan. Pilihan <em>Ramai</em> / <em>Individual</em>{" "}
                muncul saat memakai mode <em>Tulisan Biasa</em>.
              </p>
            )}
            <SvgIconManager
              icons={svgIcons}
              onChange={handleIconsChange}
              accent={form.accent}
              background={form.background}
            />
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
                  ? "Teks refleksi/pengakuan pribadi yang muncul di bawah baris lirik saat diputar. Pilih preset animasi dan ikon SVG per baris."
                  : "Pilih preset animasi dan ikon SVG untuk tiap ucapan. Ucapan akan tampil sebagai hero utama (tanpa highlight per kata) bergantian selama durasi yang dibagi rata."}
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
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className="rounded border border-white/10 bg-midnight px-2 py-1 text-[11px] font-mono text-foreground outline-none focus:border-amber-warm/40"
                            value={lineConfig[i]?.animationPreset ?? "blur-fade"}
                            onChange={(e) =>
                              patchLine(i, {
                                animationPreset: e.target
                                  .value as LineConfig["animationPreset"],
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
                      </div>
                      {svgIcons.length > 0 && (
                        <LineIconPicker
                          icons={svgIcons}
                          iconId={lineConfig[i]?.iconId}
                          iconIds={lineConfig[i]?.iconIds}
                          multi={mode === "plain" && iconLayout === "crowd"}
                          side={i % 2 === 0 ? "kiri" : "kanan"}
                          onChange={(patch) => patchLine(i, patch)}
                        />
                      )}
                      {/* Refleksi hanya di mode LRC. Mode plain: ucapan sudah
                          jadi konten utama, tidak perlu subteks. */}
                      {mode === "lrc" && (
                        <textarea
                          className="thin-scroll w-full resize-y rounded border border-white/10 bg-midnight/60 px-3 py-2 text-sm text-foreground outline-none focus:border-amber-warm/40"
                          rows={2}
                          value={lineConfig[i]?.reflection ?? ""}
                          onChange={(e) => patchLine(i, { reflection: e.target.value })}
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
              <Field label={`Jenis Dekorasi SVG (${DECORATION_KINDS.length} pilihan)`}>
                <select
                  className={inputCls}
                  value={form.decoration}
                  onChange={(e) => set("decoration", e.target.value)}
                >
                  {DECORATION_KINDS.map((d) => (
                    <option key={d} value={d}>
                      {DECORATION_INFO[d].label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                  {DECORATION_INFO[form.decoration as DecorationKind]?.hint}
                </p>
              </Field>
              <Field label="Label Tema">
                <input
                  className={inputCls}
                  value={form.themeLabel}
                  onChange={(e) => set("themeLabel", e.target.value)}
                />
              </Field>
            </div>
            {/* Preview dekorasi latar (animasi sungguhan) */}
            <div
              className="relative mt-4 h-52 overflow-hidden rounded-lg border border-white/10"
              style={
                {
                  backgroundColor: form.background,
                  "--amber-warm": form.accent,
                  "--rose-warm": form.accentSoft,
                } as React.CSSProperties
              }
            >
              <AnimatedBackground
                key={form.decoration}
                decoration={form.decoration as DecorationKind}
                activeBait={0}
              />
              <p
                className="absolute left-3 top-2 font-mono text-[10px] uppercase tracking-wider"
                style={{ color: form.accent }}
              >
                preview dekorasi · live
              </p>
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

/* ---------- Pemilih tata letak ikon (mode tanpa LRC) ---------- */
function IconLayoutPicker({
  value,
  onChange,
}: {
  value: IconLayout;
  onChange: (v: IconLayout) => void;
}) {
  const options: { v: IconLayout; title: string; desc: string }[] = [
    {
      v: "crowd",
      title: "Ramai",
      desc: "3–5 ikon kecil muncul bersamaan mengisi ruang kosong di sekitar ucapan.",
    },
    {
      v: "single",
      title: "Individual",
      desc: "Satu ikon lebih besar di atas ucapan; ucapan turun sedikit menyesuaikan.",
    },
  ];
  return (
    <div className="mb-5">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
        Tata letak ikon · mode tanpa LRC
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup">
        {options.map((o) => {
          const on = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.v)}
              className={`flex gap-3 rounded-lg border p-3 text-left transition-colors ${
                on
                  ? "border-amber-warm/50 bg-amber-warm/10"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06]"
              }`}
            >
              <LayoutSketch kind={o.v} active={on} />
              <span className="min-w-0">
                <span
                  className={`block font-mono text-[11px] uppercase tracking-wider ${
                    on ? "text-amber-warm" : "text-foreground/80"
                  }`}
                >
                  {o.title}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                  {o.desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Sketsa mini tata letak (kotak = ikon, garis = teks ucapan). */
function LayoutSketch({ kind, active }: { kind: IconLayout; active: boolean }) {
  const c = active ? "var(--amber-warm)" : "rgba(255,255,255,0.35)";
  return (
    <svg
      width="76"
      height="56"
      viewBox="0 0 76 56"
      className="shrink-0 rounded border border-white/10 bg-black/20"
      fill="none"
      aria-hidden="true"
    >
      {kind === "crowd" ? (
        <>
          {[
            [6, 6], [62, 5], [4, 24], [64, 26], [8, 42], [60, 43],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.2" />
          ))}
          <rect x="22" y="25" width="32" height="4" rx="2" fill={c} />
        </>
      ) : (
        <>
          <rect x="29" y="6" width="18" height="18" rx="3" stroke={c} strokeWidth="1.4" />
          <rect x="16" y="34" width="44" height="5" rx="2.5" fill={c} />
          <rect x="24" y="43" width="28" height="3" rx="1.5" fill={c} fillOpacity="0.5" />
        </>
      )}
    </svg>
  );
}

/* ---------- Pilih ikon manual per baris ---------- */
function LineIconPicker({
  icons,
  iconId,
  iconIds,
  multi,
  side,
  onChange,
}: {
  icons: SvgIcon[];
  iconId?: string;
  iconIds?: string[];
  /** true = mode Ramai: boleh pilih beberapa ikon (maks. 5). */
  multi: boolean;
  side: string;
  onChange: (patch: Partial<LineConfig>) => void;
}) {
  const none = iconId === ICON_NONE;
  const selected = (iconIds?.length ? iconIds : iconId && !none ? [iconId] : [])
    .filter((id) => icons.some((i) => i.id === id));
  const auto = !none && selected.length === 0;

  const setSel = (ids: string[]) =>
    onChange({ iconIds: ids.length ? ids : undefined, iconId: ids[0] });

  const toggle = (id: string) => {
    if (!multi) return setSel(selected[0] === id ? [] : [id]);
    if (selected.includes(id)) return setSel(selected.filter((x) => x !== id));
    if (selected.length >= 5) return;
    setSel([...selected, id]);
  };

  const chip = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-mono transition-colors ${
      on
        ? "border-amber-warm/60 bg-amber-warm/15 text-amber-warm"
        : "border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.08]"
    }`;

  return (
    <div className="mb-2">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
        Ikon baris ini ·{" "}
        {auto
          ? `otomatis (sisi ${side})`
          : none
            ? "tanpa ikon"
            : multi
              ? `${selected.length} dipilih (maks. 5)`
              : "dipilih manual"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={auto}
          className={chip(auto)}
          onClick={() => onChange({ iconId: undefined, iconIds: undefined })}
        >
          Otomatis
        </button>
        <button
          type="button"
          aria-pressed={none}
          className={chip(none)}
          onClick={() => onChange({ iconId: ICON_NONE, iconIds: undefined })}
        >
          Tanpa
        </button>
        {icons.map((ic) => {
          const on = selected.includes(ic.id);
          return (
            <button
              key={ic.id}
              type="button"
              aria-pressed={on}
              className={chip(on)}
              onClick={() => toggle(ic.id)}
              title={ic.name}
            >
              <IconThumb svg={ic.svg} />
              <span className="max-w-[7rem] truncate">{ic.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Thumbnail statis ikon (tanpa animasi) dari pohon SVG yang sudah di-whitelist. */
function IconThumb({ svg }: { svg: string }) {
  const parsed = useMemo(() => parseSvg(svg), [svg]);
  if (!parsed.ok) return <span className="h-4 w-4" />;
  const [x, y, w, h] = parsed.value.viewBox;
  const render = (nodes: SvgNode[]): React.ReactNode[] =>
    nodes.map((n, k) => {
      const props: Record<string, string> = {};
      for (const [a, v] of Object.entries(n.attrs))
        props[a === "fill-rule" ? "fillRule" : a] = v;
      if (n.tag === "g") return <g key={k} {...props}>{render(n.children)}</g>;
      const Tag = n.tag as "path";
      return <Tag key={k} {...props} />;
    });
  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={(Math.max(w, h) / 24) * 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {render(parsed.value.nodes)}
    </svg>
  );
}
