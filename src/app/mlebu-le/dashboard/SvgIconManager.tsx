"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Code2, Plus, RotateCcw, Trash2, Upload, Wand2 } from "lucide-react";
import { AnimatedSvgIcon } from "@/components/svg-icon/AnimatedSvgIcon";
import {
  MAX_ICONS,
  STARTER_ICONS,
  SVG_MODES,
  makeIconId,
  parseSvg,
  starterToIcon,
  type SvgIcon,
  type SvgIconMode,
} from "@/lib/svg";

/**
 * SvgIconManager
 * ------------------------------------------------------------------
 * Pustaka ikon SVG animasi untuk satu arsip. Ikon ditambahkan lewat:
 *   1. Upload file .svg (boleh banyak sekaligus)
 *   2. Tulis / tempel kode SVG langsung
 *   3. Ikon contoh (satu klik)
 * Tiap ikon punya mode animasi (outline neon / fill), warna opsional,
 * dan preview live yang memutar masuk → idle → keluar berulang.
 * ------------------------------------------------------------------ */

interface SvgIconManagerProps {
  icons: SvgIcon[];
  onChange: (icons: SvgIcon[]) => void;
  /** Warna aksen arsip — dipakai preview bila ikon tidak punya warna sendiri. */
  accent: string;
  background: string;
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-amber-warm/40";
const btnCls =
  "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-mono uppercase tracking-wider text-amber-warm transition-colors hover:bg-white/[0.07] disabled:opacity-40 disabled:hover:bg-white/[0.03]";

/** Validasi semua ikon di sisi client (dipanggil MemoryForm saat submit). */
export function validateIconsClient(icons: SvgIcon[]): string | null {
  for (const ic of icons) {
    const r = parseSvg(ic.svg);
    if (!r.ok) return `Ikon "${ic.name}": ${r.error}`;
  }
  return null;
}

export function SvgIconManager({
  icons,
  onChange,
  accent,
  background,
}: SvgIconManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [writerOpen, setWriterOpen] = useState(false);
  const full = icons.length >= MAX_ICONS;

  const add = (incoming: SvgIcon[]) => {
    const room = MAX_ICONS - icons.length;
    if (incoming.length > room) {
      setNotice(`Maksimal ${MAX_ICONS} ikon per arsip — sebagian tidak ditambahkan.`);
    }
    onChange([...icons, ...incoming.slice(0, Math.max(room, 0))]);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: SvgIcon[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 200_000) {
        errors.push(`${file.name}: terlalu besar (maks 200 KB).`);
        continue;
      }
      const text = await file.text();
      const r = parseSvg(text);
      if (!r.ok) {
        errors.push(`${file.name}: ${r.error}`);
        continue;
      }
      added.push({
        id: makeIconId(),
        name: file.name.replace(/\.svg$/i, "").slice(0, 40) || "Ikon",
        svg: text.trim(),
        mode: "outline",
        color: "",
      });
    }
    if (added.length) add(added);
    setNotice(errors.length ? errors.join("\n") : null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const update = (id: string, patch: Partial<SvgIcon>) =>
    onChange(icons.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id: string) => onChange(icons.filter((i) => i.id !== id));

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Setiap baris lirik menampilkan satu ikon di samping teks,{" "}
        <span className="text-amber-warm/80">bergantian kiri dan kanan</span>.
        Ikon dipakai bergiliran sesuai urutan di bawah (bisa dipilih manual per
        baris). Hanya bentuk{" "}
        <code className="font-mono text-amber-warm/80">
          path, circle, ellipse, line, polyline, polygon, rect
        </code>{" "}
        yang dianimasikan; warna asli SVG diganti warna aksen.
      </p>

      {/* Aksi tambah */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".svg,image/svg+xml"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <button
          type="button"
          className={btnCls}
          disabled={full}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" /> Upload .svg
        </button>
        <button
          type="button"
          className={btnCls}
          disabled={full}
          onClick={() => setWriterOpen((v) => !v)}
        >
          <Code2 className="h-3.5 w-3.5" /> Tulis kode SVG
        </button>
        <span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          {icons.length}/{MAX_ICONS} ikon
        </span>
      </div>

      {/* Ikon contoh */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          <Wand2 className="h-3 w-3" /> contoh:
        </span>
        {STARTER_ICONS.map((s) => (
          <button
            key={s.name}
            type="button"
            disabled={full}
            onClick={() => add([starterToIcon(s)])}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-foreground/80 transition-colors hover:bg-white/[0.08] disabled:opacity-40"
          >
            <Plus className="h-3 w-3 text-amber-warm" /> {s.name}
          </button>
        ))}
      </div>

      {notice && (
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-rose-warm/30 bg-rose-warm/10 px-3 py-2 font-mono text-[11px] text-rose-warm">
          {notice}
        </pre>
      )}

      {writerOpen && (
        <SvgWriter
          accent={accent}
          background={background}
          onCancel={() => setWriterOpen(false)}
          onAdd={(icon) => {
            add([icon]);
            setWriterOpen(false);
            setNotice(null);
          }}
        />
      )}

      {/* Daftar ikon */}
      {icons.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {icons.map((icon, idx) => (
            <IconCard
              key={icon.id}
              index={idx}
              icon={icon}
              accent={accent}
              background={background}
              onUpdate={(patch) => update(icon.id, patch)}
              onRemove={() => remove(icon.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------
 * Preview: memutar masuk → idle → keluar berulang
 * ---------------------------------------------------------------- */
function IconPreview({
  icon,
  accent,
  background,
  size = 84,
  side = "left",
}: {
  icon: SvgIcon;
  accent: string;
  background: string;
  size?: number;
  side?: "left" | "right";
}) {
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [tick, setTick] = useState(0);

  // Siklus: tampil ±3.6 dtk → keluar ±1.2 dtk → masuk lagi.
  useEffect(() => {
    const t = setTimeout(
      () => setPhase((p) => (p === "in" ? "out" : "in")),
      phase === "in" ? 3600 : 1200,
    );
    return () => clearTimeout(t);
  }, [phase, tick]);

  const style = {
    "--amber-warm": accent,
    backgroundColor: background,
    backgroundImage:
      "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
    backgroundSize: "16px 16px",
  } as CSSProperties;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-lg border border-white/10"
      style={{ ...style, width: size + 32, height: size + 32 }}
    >
      {/* key = svg + mode → mount ulang bila kode/mode berubah */}
      <AnimatedSvgIcon
        key={`${icon.svg}|${icon.mode}`}
        icon={icon}
        side={side}
        size={size}
        phase={phase}
      />
      <button
        type="button"
        onClick={() => {
          setPhase("in");
          setTick((n) => n + 1);
        }}
        className="absolute bottom-1 right-1 rounded bg-black/40 p-1 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Putar ulang animasi"
        title="Putar ulang"
      >
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------
 * ModeToggle — outline neon / fill
 * ---------------------------------------------------------------- */
function ModeToggle({
  value,
  onChange,
}: {
  value: SvgIconMode;
  onChange: (m: SvgIconMode) => void;
}) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Mode animasi">
      {SVG_MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          title={m.hint}
          onClick={() => onChange(m.value)}
          className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
            value === m.value
              ? "bg-amber-warm/20 text-amber-warm"
              : "border border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.07]"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------
 * IconCard — satu ikon di pustaka
 * ---------------------------------------------------------------- */
function IconCard({
  index,
  icon,
  accent,
  background,
  onUpdate,
  onRemove,
}: {
  index: number;
  icon: SvgIcon;
  accent: string;
  background: string;
  onUpdate: (patch: Partial<SvgIcon>) => void;
  onRemove: () => void;
}) {
  const [codeOpen, setCodeOpen] = useState(false);
  const parsed = useMemo(() => parseSvg(icon.svg), [icon.svg]);

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="flex gap-3">
        <IconPreview
          icon={icon}
          accent={accent}
          background={background}
          size={64}
          side={index % 2 === 0 ? "left" : "right"}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-amber-warm/70">
              #{index + 1}
            </span>
            <input
              className={`${inputCls} py-1`}
              value={icon.name}
              maxLength={40}
              onChange={(e) => onUpdate({ name: e.target.value })}
              aria-label="Nama ikon"
            />
            <button
              type="button"
              onClick={onRemove}
              className="shrink-0 rounded-md border border-white/10 p-1.5 text-muted-foreground transition-colors hover:bg-rose-warm/15 hover:text-rose-warm"
              aria-label={`Hapus ikon ${icon.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <ModeToggle value={icon.mode} onChange={(mode) => onUpdate({ mode })} />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={icon.color || accent}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="h-7 w-7 cursor-pointer rounded border border-white/10 bg-transparent"
              aria-label="Warna ikon"
            />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {icon.color ? icon.color : "ikut aksen"}
            </span>
            {icon.color && (
              <button
                type="button"
                onClick={() => onUpdate({ color: "" })}
                className="font-mono text-[10px] uppercase tracking-wider text-amber-warm/80 hover:underline"
              >
                reset
              </button>
            )}
            <button
              type="button"
              onClick={() => setCodeOpen((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <Code2 className="h-3 w-3" /> {codeOpen ? "tutup" : "kode"}
            </button>
          </div>
        </div>
      </div>

      {!parsed.ok && (
        <p className="mt-2 rounded border border-rose-warm/30 bg-rose-warm/10 px-2 py-1.5 font-mono text-[11px] text-rose-warm">
          {parsed.error}
        </p>
      )}

      {codeOpen && (
        <textarea
          className={`${inputCls} thin-scroll mt-3 min-h-[120px] resize-y font-mono text-xs`}
          value={icon.svg}
          spellCheck={false}
          onChange={(e) => onUpdate({ svg: e.target.value })}
          aria-label="Kode SVG"
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------
 * SvgWriter — tulis/tempel kode SVG dengan preview langsung
 * ---------------------------------------------------------------- */
const WRITER_PLACEHOLDER = `<svg viewBox="0 0 24 24">
  <path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.8 5.5 21 7.5 13.5 2 9h7z"/>
</svg>`;

function SvgWriter({
  accent,
  background,
  onAdd,
  onCancel,
}: {
  accent: string;
  background: string;
  onAdd: (icon: SvgIcon) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<SvgIconMode>("outline");

  const parsed = useMemo(
    () => (code.trim() ? parseSvg(code) : null),
    [code],
  );
  const valid = parsed?.ok === true;

  const draft: SvgIcon = {
    id: "draft",
    name,
    svg: code.trim(),
    mode,
    color: "",
  };

  return (
    <div className="mt-4 rounded-lg border border-amber-warm/20 bg-white/[0.02] p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <input
            className={inputCls}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama ikon (mis. Hati kecil)"
            aria-label="Nama ikon"
          />
          <textarea
            className={`${inputCls} thin-scroll min-h-[150px] resize-y font-mono text-xs`}
            value={code}
            spellCheck={false}
            onChange={(e) => setCode(e.target.value)}
            placeholder={WRITER_PLACEHOLDER}
            aria-label="Kode SVG"
          />
          <ModeToggle value={mode} onChange={setMode} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
            preview · live
          </span>
          {valid ? (
            <IconPreview
              icon={draft}
              accent={accent}
              background={background}
              size={84}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-lg border border-dashed border-white/10 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50"
              style={{ width: 116, height: 116 }}
            >
              menunggu kode
            </div>
          )}
        </div>
      </div>

      {parsed && !parsed.ok && (
        <p className="mt-3 rounded border border-rose-warm/30 bg-rose-warm/10 px-2 py-1.5 font-mono text-[11px] text-rose-warm">
          {parsed.error}
        </p>
      )}
      {parsed && parsed.ok && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {parsed.value.shapeCount} bentuk terdeteksi · viewBox{" "}
          {parsed.value.viewBox.join(" ")}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={btnCls} onClick={onCancel}>
          Batal
        </button>
        <button
          type="button"
          className={`${btnCls} bg-amber-warm/15`}
          disabled={!valid}
          onClick={() =>
            onAdd({
              id: makeIconId(),
              name: name.trim() || "Ikon baru",
              svg: code.trim(),
              mode,
              color: "",
            })
          }
        >
          <Plus className="h-3.5 w-3.5" /> Tambahkan
        </button>
      </div>
    </div>
  );
}
