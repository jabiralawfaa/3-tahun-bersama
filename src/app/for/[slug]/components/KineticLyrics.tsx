"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { formatTime, type ParsedLrcLine } from "@/lib/lrc";
import type {
  AnimationPreset,
  IconLayout,
  MemoryMode,
} from "@/data/memories";
import { ICON_NONE, resolveLineIcon, type SvgIcon } from "@/lib/svg";
import { AnimatedSvgIcon } from "@/components/svg-icon/AnimatedSvgIcon";
import { LineImage } from "@/components/media/LineImage";

/**
 * KineticLyrics (versi ringan)
 * ------------------------------------------------------------------
 * Tampilan sama (3D flip / zoom in / zoom out / blur-fade, kata masuk
 * bergiliran, gerak natural, ikon SVG), tetapi dibangun ulang agar
 * murah untuk PC/laptop lama:
 *
 *  - Semua gerak memakai CSS (transform/opacity) → jalan di GPU
 *    compositor, tanpa animasi JavaScript per frame. Gaya ada di
 *    globals.css (kelas .kl-*, .kw, .kword).
 *  - Komponen hanya re-render saat baris / kata aktif berganti (bukan
 *    60x per detik): waktu tidak lagi dipasok sebagai prop.
 *  - Tanpa AnimatePresence: hanya ada 1 layer aktif + maksimal 1 layer
 *    yang sedang keluar (±0,35 dtk) di sel grid yang sama. Baris
 *    sebelumnya, label baris, dan refleksi tidak akan menumpuk walau
 *    lagu berpindah baris sangat cepat atau perangkat lag.
 *  - Tata letak ikon: grid 2 kolom (ikon separuh, teks separuh),
 *    bergantian kiri/kanan tiap baris.
 *  - Mode tanpa LRC (ucapan biasa): ikon tampil "ramai" (3–5 ikon kecil
 *    mengisi ruang kosong di sekitar ucapan) atau "individual" (satu ikon
 *    besar di atas ucapan). Teks tetap di tengah.
 *  - Mode ringan (data-perf="low" di <main>) mematikan gerak idle,
 *    blur, dan condong 3D — lihat globals.css.
 * ------------------------------------------------------------------ */
interface KineticLyricsProps {
  lines: ParsedLrcLine[];
  activeIndex: number;
  /** Indeks kata aktif di baris aktif (mode LRC); -1 bila tidak ada. */
  activeWord: number;
  isEnding: boolean;
  /** Mode tampilan: "lrc" (lirik + highlight per kata) atau "plain" (ucapan hero). */
  mode?: MemoryMode;
  /** Pustaka ikon SVG milik arsip ini. Kosong = tanpa ikon. */
  icons?: SvgIcon[];
  /** Tata letak ikon pada mode ucapan biasa: ramai / individual. */
  iconLayout?: IconLayout;
}

/** Ikon mengisi separuh kolomnya, dibatasi agar tidak melebihi tinggi layar. */
const ICON_SIZE = "min(100%, 14rem, 34vh)";
/** Lama animasi keluar (harus ≥ durasi .kl-layer[data-phase=leave] di CSS). */
const LEAVE_MS = 380;

type Side = "left" | "right";

export const KineticLyrics = memo(function KineticLyrics({
  lines,
  activeIndex,
  activeWord,
  isEnding,
  mode = "lrc",
  icons = [],
  iconLayout = "crowd",
}: KineticLyricsProps) {
  const activeLine = activeIndex >= 0 ? lines[activeIndex] : undefined;

  /* --- Muat lebih dulu gambar 2 baris berikutnya (anti pop-in) --- */
  useEffect(() => {
    for (let k = 1; k <= 2; k++) {
      const url = lines[activeIndex + k]?.imageUrl;
      if (url) {
        const im = new Image();
        im.decoding = "async";
        im.src = url;
      }
    }
  }, [lines, activeIndex]);

  /* --- Maksimal SATU layer yang sedang keluar --- */
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const prevIndexRef = useRef(activeIndex);
  useEffect(() => {
    const prev = prevIndexRef.current;
    prevIndexRef.current = activeIndex;
    if (prev < 0 || prev === activeIndex) return;
    setLeavingIndex(prev);
    const t = setTimeout(() => setLeavingIndex(null), LEAVE_MS);
    return () => clearTimeout(t);
  }, [activeIndex]);
  const leavingLine =
    leavingIndex !== null && leavingIndex !== activeIndex
      ? lines[leavingIndex]
      : undefined;

  /* --- Condong 3D halus mengikuti mouse (CSS variable, tanpa re-render) --- */
  const tiltRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || rafRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = tiltRef.current;
      if (!el) return;
      el.style.setProperty("--kl-ry", `${(nx * 16).toFixed(2)}deg`);
      el.style.setProperty("--kl-rx", `${(-ny * 12).toFixed(2)}deg`);
    });
  };
  const handleLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty("--kl-ry", "0deg");
    el.style.setProperty("--kl-rx", "0deg");
  };

  const preset = activeLine?.animationPreset ?? "blur-fade";
  const activeIcon = activeLine
    ? resolveLineIcon(activeLine.index, activeLine.iconId, icons)
    : null;
  const activeImage = activeLine?.imageUrl ?? null;

  return (
    <div
      className="relative z-10 flex min-h-[58vh] flex-col items-center justify-center px-5 sm:px-8"
      aria-live="polite"
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {/* Label monospace kecil — alat bantu desainer */}
      <div className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-warm/80" />
        <span>{mode === "plain" ? "spoken" : "kinetic-lyrics"}</span>
        <span className="opacity-40">·</span>
        <span className="text-amber-warm/70">{preset}</span>
        {(activeImage || activeIcon) && (
          <>
            <span className="opacity-40">·</span>
            <span className="text-amber-warm/70">
              {activeImage
                ? "image"
                : activeIcon?.mode === "fill"
                  ? "icon:fill"
                  : "icon:neon"}
            </span>
          </>
        )}
      </div>

      <div ref={tiltRef} className="kl-tilt w-full">
        <div className={`kl-stage ${mode === "plain" ? "kl-stage--plain" : ""}`}>
          {/* Urutan DOM tetap: [keluar][aktif] → instance tidak di-remount */}
          {leavingLine && (
            <Layer
              key={leavingLine.index}
              line={leavingLine}
              total={lines.length}
              phase="leave"
              activeWord={-2}
              mode={mode}
              layout={iconLayout}
              icons={icons}
              icon={resolveLineIcon(
                leavingLine.index,
                leavingLine.iconId,
                icons,
              )}
              image={leavingLine.imageUrl ?? null}
              prevText={lines[leavingLine.index - 1]?.text}
              nextText={lines[leavingLine.index + 1]?.text}
            />
          )}
          {activeLine && (
            <Layer
              key={activeLine.index}
              line={activeLine}
              total={lines.length}
              phase={isEnding ? "leave" : "enter"}
              activeWord={isEnding ? -2 : activeWord}
              mode={mode}
              layout={iconLayout}
              icons={icons}
              icon={activeIcon}
              image={activeImage}
              prevText={lines[activeLine.index - 1]?.text}
              nextText={lines[activeLine.index + 1]?.text}
            />
          )}
        </div>
      </div>
    </div>
  );
});

/* ----------------------------------------------------------------
 * Layer — satu baris lengkap: preview atas, [ikon | teks], refleksi,
 * preview bawah. Di-memo: layer yang tidak berubah tidak dirender ulang.
 * ---------------------------------------------------------------- */
interface LayerProps {
  line: ParsedLrcLine;
  total: number;
  phase: "enter" | "leave";
  /** Kata aktif; -2 = tidak ada sorotan (layer sedang keluar). */
  activeWord: number;
  mode: MemoryMode;
  layout: IconLayout;
  /** Seluruh pustaka ikon (dipakai tata letak "ramai"). */
  icons: SvgIcon[];
  icon: SvgIcon | null;
  /** URL gambar dari pustaka Media; bila ada menggantikan ikon SVG. */
  image: string | null;
  prevText?: string;
  nextText?: string;
}

const Layer = memo(function Layer({
  line,
  total,
  phase,
  activeWord,
  mode,
  layout,
  icons,
  icon,
  image,
  prevText,
  nextText,
}: LayerProps) {
  const preset: AnimationPreset = line.animationPreset;
  // Genap = ikon di kiri, ganjil = ikon di kanan (bergantian).
  const side: Side = line.index % 2 === 1 ? "right" : "left";
  const hasIcon = !!icon || !!image;
  // Durasi "kamera" = durasi baris, dibatasi agar gerak tetap terasa.
  const driftSeconds = Math.min(Math.max(line.endTime - line.time, 2.5), 14);

  // Mode LRC + baris "ramai": lirik di tengah, 3–5 ikon kecil di sekeliling,
  // tanpa refleksi & tanpa pratinjau baris (sama konsep dengan mode tanpa LRC).
  if (mode === "lrc" && line.crowd) {
    return (
      <PlainLayer
        line={line}
        total={total}
        phase={phase}
        layout="crowd"
        icons={icons}
        icon={icon}
        image={image}
        side={side}
        driftSeconds={driftSeconds}
        lrc
        activeWord={activeWord}
      />
    );
  }

  if (mode === "plain") {
    return (
      <PlainLayer
        line={line}
        total={total}
        phase={phase}
        layout={layout}
        icons={icons}
        icon={icon}
        image={image}
        side={side}
        driftSeconds={driftSeconds}
      />
    );
  }

  // Hanya mode LRC yang sampai di sini (mode plain sudah memakai PlainLayer).
  const textSize = hasIcon
    ? "text-2xl sm:text-4xl lg:text-5xl leading-tight"
    : "text-3xl sm:text-5xl md:text-6xl leading-tight";

  return (
    <div
      className="kl-layer"
      data-phase={phase}
      data-preset={preset}
      data-side={side}
    >
      {/* Baris sebelumnya (preview redup di atas) */}
      {prevText && (
        <p className="kl-preview mb-6 max-w-2xl text-center text-sm text-muted-foreground/50 sm:text-base">
          {prevText}
        </p>
      )}

      {/* Grid 2 kolom: ikon separuh, teks separuh — bergantian kiri/kanan */}
      <div
        className={`kl-row ${
          hasIcon
            ? `kl-row--icon ${side === "right" ? "kl-row--icon-right" : ""}`
            : ""
        }`}
      >
        {(image || icon) && (
          <div className="kl-icon-cell">
            {image ? (
              <LineImage
                src={image}
                side={side}
                variant="cell"
                phase={phase === "enter" ? "in" : "out"}
              />
            ) : icon ? (
              <AnimatedSvgIcon
                icon={icon}
                side={side}
                size={ICON_SIZE}
                phase={phase === "enter" ? "in" : "out"}
              />
            ) : null}
          </div>
        )}

        <div className="kl-text-cell">
          <TextFrame
            line={line}
            total={total}
            mode={mode}
            activeWord={activeWord}
            preset={preset}
            driftSeconds={driftSeconds}
            textSize={textSize}
          />
        </div>
      </div>

      {/* Subteks refleksi — hanya mode LRC */}
      {mode === "lrc" && line.reflection && (
        <p className="kl-ref mt-10 max-w-xl text-center font-serif text-base italic leading-relaxed text-foreground/70 sm:text-lg">
          <span className="mr-1 text-amber-warm/50">“</span>
          {line.reflection}
          <span className="ml-1 text-amber-warm/50">”</span>
        </p>
      )}

      {/* Baris berikutnya (preview redup di bawah) */}
      {nextText && (
        <p className="kl-preview mt-6 max-w-2xl text-center text-sm text-muted-foreground/50 sm:text-base">
          {nextText}
        </p>
      )}
    </div>
  );
});

/* ---------- Mode LRC: highlight per kata ---------- */
function LrcWords({
  line,
  activeWord,
}: {
  line: ParsedLrcLine;
  activeWord: number;
}) {
  return (
    <>
      {line.words.map((w, i) => (
        <span key={i} className="kw" style={{ "--wi": i } as CSSProperties}>
          <span
            className={`kword ${i === activeWord ? "is-active" : ""}`}
            style={{ "--wi": i } as CSSProperties}
          >
            {w.text}
          </span>
        </span>
      ))}
    </>
  );
}

/* ---------- Mode plain: ucapan hero ---------- */
function PlainWords({ text }: { text: string }) {
  const tokens = useMemo(() => {
    const parts = text.split(" ");
    return parts.map((t, i) => (i < parts.length - 1 ? `${t} ` : t));
  }, [text]);
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className="kw" style={{ "--wi": i } as CSSProperties}>
          <span
            className="kword is-plain"
            style={{ "--wi": i } as CSSProperties}
          >
            {t}
          </span>
        </span>
      ))}
    </>
  );
}

/* ----------------------------------------------------------------
 * Mode tanpa LRC (ucapan biasa)
 *  - "single": satu ikon besar di atas ucapan; ucapan ikut turun sedikit.
 *  - "crowd" : 3–5 ikon kecil di sekeliling ucapan (ruang kosong).
 * Teks selalu di tengah secara horizontal.
 * ---------------------------------------------------------------- */

/** Slot di sekeliling area teks (persen dari panggung). `mid` = sisi
 *  tengah yang bisa menabrak teks di layar sempit → disembunyikan di HP. */
const CROWD_SLOTS: { x: number; y: number; mid?: boolean }[] = [
  { x: 7, y: 15 },
  { x: 93, y: 13 },
  { x: 4, y: 50, mid: true },
  { x: 96, y: 52, mid: true },
  { x: 10, y: 85 },
  { x: 90, y: 87 },
  { x: 30, y: 6 },
  { x: 70, y: 7 },
  { x: 29, y: 94 },
  { x: 71, y: 93 },
];

interface CrowdItem {
  icon: SvgIcon;
  x: number;
  y: number;
  mid: boolean;
  scale: number;
  rot: number;
  side: Side;
  delay: number;
}

/** Pilih 3–5 ikon + slotnya secara deterministik per baris. */
function pickCrowd(
  index: number,
  icons: SvgIcon[],
  forced: SvgIcon[],
): CrowdItem[] {
  if (!icons.length) return [];
  // Pilihan manual: pakai ikon pilihan (diulang bila < 3), selebihnya otomatis.
  const count = forced.length
    ? Math.min(5, Math.max(3, forced.length))
    : 3 + (index % 3);
  const start = (index * 3) % CROWD_SLOTS.length;
  const items: CrowdItem[] = [];
  for (let k = 0; k < count; k++) {
    const slot = CROWD_SLOTS[(start + k * 3) % CROWD_SLOTS.length];
    items.push({
      icon: forced.length
        ? forced[k % forced.length]
        : icons[(index + k) % icons.length],
      x: slot.x,
      y: slot.y,
      mid: !!slot.mid,
      scale: 0.8 + ((index + k * 5) % 5) * 0.1,
      rot: (((index + k * 7) % 9) - 4) * 6,
      side: slot.x < 50 ? "left" : "right",
      delay: 150 + k * 140,
    });
  }
  return items;
}

function PlainLayer({
  line,
  total,
  phase,
  layout,
  icons,
  icon,
  image,
  side,
  driftSeconds,
  lrc = false,
  activeWord = -2,
}: {
  line: ParsedLrcLine;
  total: number;
  phase: "enter" | "leave";
  layout: IconLayout;
  icons: SvgIcon[];
  icon: SvgIcon | null;
  image: string | null;
  side: Side;
  driftSeconds: number;
  /** true = baris mode LRC bergaya ramai (highlight per kata tetap jalan). */
  lrc?: boolean;
  activeWord?: number;
}) {
  const preset = line.animationPreset;
  const iconPhase = phase === "enter" ? "in" : "out";
  const none = line.iconId === ICON_NONE;
  // Gambar selalu tampil sebagai "hero" di atas ucapan (ucapan ikut turun).
  const single = !!image || (layout === "single" && !!icon);

  const crowd = useMemo(
    () =>
      layout === "crowd" && !none
        ? pickCrowd(
            line.index,
            icons,
            (line.iconIds?.length ? line.iconIds : line.iconId ? [line.iconId] : [])
              .map((id) => icons.find((i) => i.id === id))
              .filter((i): i is SvgIcon => !!i),
          )
        : [],
    [layout, none, line.index, line.iconId, line.iconIds, icons],
  );

  const textSize =
    single || lrc
      ? "text-3xl sm:text-5xl md:text-6xl leading-[1.15]"
      : "text-4xl sm:text-6xl md:text-7xl leading-[1.15]";

  return (
    <div
      className={`kl-layer kl-layer--plain ${single ? "kl-layer--single" : ""} ${
        lrc ? "kl-layer--lrc-crowd" : ""
      }`}
      data-phase={phase}
      data-preset={preset}
      data-side={side}
    >
      {/* Ramai: ikon kecil di sekeliling teks */}
      {crowd.length > 0 && (
        <div className="kl-crowd" aria-hidden="true">
          {crowd.map((c, k) => (
            <div
              key={k}
              className={`kl-crowd-item ${c.mid ? "kl-crowd-item--mid" : ""}`}
              style={
                {
                  left: `${c.x}%`,
                  top: `${c.y}%`,
                  "--cs": c.scale,
                  "--cr": `${c.rot}deg`,
                } as CSSProperties
              }
            >
              <AnimatedSvgIcon
                icon={c.icon}
                side={c.side}
                size="100%"
                phase={iconPhase}
                delay={c.delay}
              />
            </div>
          ))}
        </div>
      )}

      {/* Individual: satu ikon lebih besar di atas ucapan */}
      {single && (image || icon) && (
        <div className="kl-single-icon">
          {image ? (
            <LineImage
              src={image}
              side={side}
              variant="hero"
              phase={iconPhase}
            />
          ) : icon ? (
            <AnimatedSvgIcon
              icon={icon}
              side={side}
              size="min(46vw, 11.5rem, 27vh)"
              phase={iconPhase}
            />
          ) : null}
        </div>
      )}

      <TextFrame
        line={line}
        total={total}
        mode={lrc ? "lrc" : "plain"}
        activeWord={lrc ? activeWord : -2}
        preset={preset}
        driftSeconds={driftSeconds}
        textSize={textSize}
      />
    </div>
  );
}

/* ----------------------------------------------------------------
 * TextFrame — frame teks (selection-frame + kamera + napas + kata)
 * ---------------------------------------------------------------- */
function TextFrame({
  line,
  total,
  mode,
  activeWord,
  preset,
  driftSeconds,
  textSize,
}: {
  line: ParsedLrcLine;
  total: number;
  mode: MemoryMode;
  activeWord: number;
  preset: AnimationPreset;
  driftSeconds: number;
  textSize: string;
}) {
  return (
    <div className="selection-frame relative mx-auto my-3 inline-block max-w-full px-4 py-4 sm:px-6">
      <div
        className={`kl-anim text-center font-sans font-semibold tracking-tight ${textSize}`}
      >
        <div
          className="kl-drift"
          data-preset={preset}
          style={{ "--kl-dur": `${driftSeconds}s` } as CSSProperties}
        >
          <div className="kl-idle">
            {mode === "plain" ? (
              <PlainWords text={line.text} />
            ) : (
              <LrcWords line={line} activeWord={activeWord} />
            )}
          </div>
        </div>
      </div>

      {/* Label waktu + indeks di sudut frame (ala editor) */}
      <div className="kl-label absolute -top-5 left-0 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-warm/60">
        {mode === "plain" ? "spoken_" : "line_"}
        {String(line.index + 1).padStart(2, "0")} · {formatTime(line.time)}
      </div>
      <div className="kl-label absolute -bottom-5 right-0 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
        {mode === "plain" ? `${total} lines` : `${line.words.length} words`}
      </div>
    </div>
  );
}
