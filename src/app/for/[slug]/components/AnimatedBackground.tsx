"use client";

import { memo, type CSSProperties } from "react";
import type { DecorationKind } from "@/data/memories";

/**
 * AnimatedBackground (versi ringan)
 * ------------------------------------------------------------------
 * Lapisan dekoratif SVG/HTML beranimasi yang memperkuat identitas
 * mahasiswa IT & desainer (Figma design canvas):
 *   - Bezier Curves & Vector Nodes : garis pen-tool menggambar diri
 *   - Constellation / Starlight    : rasi bintang + kilauan sparkle
 *   - Floating Wireframe / Orbit   : cincin orbit + kursor desainer
 *   - Aurora, Gelombang, Wireframe 3D, Sirkuit, Hujan Kode, Bokeh,
 *     Bintang Jatuh, Mandala (dekorasi tambahan)
 *
 * Dibangun ulang agar murah untuk GPU/CPU lama:
 *  - Semua animasi tak berujung adalah transform/opacity CSS pada
 *    elemen HTML (jalur compositor). Tidak ada lagi animasi atribut
 *    SVG (cx/cy/scale) yang memaksa repaint seluruh <svg> tiap frame.
 *  - Garis SVG hanya menggambar diri SEKALI lalu diam.
 *  - Komponen di-memo & tidak lagi me-restart animasi saat bait ganti.
 *  - Mode ringan (data-perf="low") mematikan seluruh animasi .bgfx.
 * ------------------------------------------------------------------ */
interface AnimatedBackgroundProps {
  decoration: DecorationKind;
  /** 0–2: sedikit variasi kecerahan garis saat bait berganti */
  activeBait?: number;
}

// Koordinat dirancang pada kanvas 1400×700 → dikonversi ke persen.
const px = (x: number) => `${(x / 1400) * 100}%`;
const py = (y: number) => `${(y / 700) * 100}%`;

export const AnimatedBackground = memo(function AnimatedBackground({
  decoration,
  activeBait = 0,
}: AnimatedBackgroundProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ "--bait": activeBait } as CSSProperties}
    >
      {/* Dot grid canvas */}
      <div className="absolute inset-0 bg-dot-grid-fine opacity-70" />

      {/* Aura hangat yang bergerak perlahan */}
      <div className="bgfx bg-aura-a absolute -top-1/4 left-1/2 h-[60rem] w-[60rem] -translate-x-1/2 glow-amber" />
      <div className="bgfx bg-aura-b absolute bottom-[-20%] right-[-10%] h-[48rem] w-[48rem] glow-rose" />

      {decoration === "bezier" && <BezierLayer />}
      {decoration === "constellation" && <ConstellationLayer />}
      {decoration === "orbit" && <OrbitLayer />}
      {decoration === "aurora" && <AuroraLayer />}
      {decoration === "waves" && <WavesLayer />}
      {decoration === "wireframe" && <WireframeLayer />}
      {decoration === "circuit" && <CircuitLayer />}
      {decoration === "code-rain" && <CodeRainLayer />}
      {decoration === "bokeh" && <BokehLayer />}
      {decoration === "shooting-stars" && <ShootingStarsLayer />}
      {decoration === "mandala" && <MandalaLayer />}

      <Sparkles />
      <DesignerCursor />

      {/* Vignette agar teks tetap fokus di tengah */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 45%, rgba(8,8,14,0.55) 100%)",
        }}
      />
    </div>
  );
});

/* ----------------------------------------------------------------
 * Bezier Curves & Vector Nodes
 * ---------------------------------------------------------------- */
const BEZIER_PATHS = [
  "M 40 320 C 180 120, 420 520, 680 220 S 1180 80, 1320 320",
  "M 60 540 C 220 360, 520 640, 820 380 S 1240 300, 1340 520",
  "M 120 140 C 360 60, 540 300, 860 180 S 1180 420, 1280 200",
];

const BEZIER_NODES = BEZIER_PATHS.flatMap((_, index) =>
  [
    { x: 40 + index * 30, y: 320 + index * 10 },
    { x: 680 + index * 20, y: 220 + index * 40 },
    { x: 1320 - index * 20, y: 320 + index * 30 },
  ].map((n, i) => ({ ...n, index, i })),
);

function BezierLayer() {
  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1400 700"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        style={{ opacity: "calc(0.45 + var(--bait) * 0.05)" }}
      >
        {BEZIER_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            className="bgfx bg-draw"
            pathLength={1}
            stroke="var(--amber-warm)"
            strokeWidth={1.25}
            strokeOpacity={0.6}
            style={{ "--bgd": `${i * 0.4}s`, "--bgt": "3.5s" } as CSSProperties}
          />
        ))}
        {/* Garis handle pen-tool (statis) */}
        {BEZIER_NODES.map((n) => (
          <line
            key={`h-${n.index}-${n.i}`}
            x1={n.x}
            y1={n.y}
            x2={n.x + (n.i % 2 === 0 ? 36 : -36)}
            y2={n.y + (n.i % 2 === 0 ? 24 : -24)}
            stroke="var(--amber-warm)"
            strokeOpacity={0.4}
            strokeWidth={0.75}
            strokeDasharray="2 3"
          />
        ))}
      </svg>
      {/* Anchor node: HTML agar denyutnya jalan di compositor */}
      {BEZIER_NODES.map((n) => (
        <span
          key={`n-${n.index}-${n.i}`}
          className="bgfx bg-pulse absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-[var(--amber-warm)]"
          style={
            {
              left: px(n.x),
              top: py(n.y),
              background: "var(--canvas-bg, oklch(0.12 0.02 270))",
              "--bgp": `${3 + n.i * 0.6}s`,
              "--bgd": `${n.index * 0.3 + n.i * 0.4}s`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

/* ----------------------------------------------------------------
 * Constellation / Starlight
 * ---------------------------------------------------------------- */
const STARS = [
  { x: 120, y: 110 },
  { x: 280, y: 200 },
  { x: 440, y: 90 },
  { x: 620, y: 240 },
  { x: 800, y: 130 },
  { x: 980, y: 260 },
  { x: 1180, y: 150 },
  { x: 1320, y: 90 },
  { x: 220, y: 460 },
  { x: 520, y: 540 },
  { x: 860, y: 480 },
  { x: 1140, y: 560 },
];
const CONSTELLATIONS = [
  [STARS[0], STARS[1], STARS[3], STARS[5]],
  [STARS[2], STARS[4], STARS[6], STARS[7]],
  [STARS[8], STARS[9], STARS[10], STARS[11]],
];

function ConstellationLayer() {
  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.5]"
        viewBox="0 0 1400 700"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        {CONSTELLATIONS.map((pts, li) => (
          <polyline
            key={li}
            points={pts.map((s) => `${s.x},${s.y}`).join(" ")}
            className="bgfx bg-draw"
            pathLength={1}
            stroke="var(--amber-warm)"
            strokeOpacity={0.5}
            strokeWidth={0.8}
            style={
              { "--bgd": `${li * 0.5}s`, "--bgt": "2.8s" } as CSSProperties
            }
          />
        ))}
      </svg>
      {STARS.map((s, i) => (
        <span
          key={i}
          className="bgfx bg-twinkle absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={
            {
              left: px(s.x),
              top: py(s.y),
              background: "var(--amber-warm)",
              boxShadow:
                "0 0 0 3px color-mix(in srgb, var(--amber-warm) 14%, transparent)",
              "--bgp": `${2.4 + (i % 5) * 0.5}s`,
              "--bgd": `${i * 0.18}s`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

/* ----------------------------------------------------------------
 * Floating Wireframe / Orbit Rings
 * ---------------------------------------------------------------- */
const RINGS = [
  { r: 240, rot: 0 },
  { r: 320, rot: 24 },
  { r: 420, rot: 48 },
  { r: 180, rot: 72 },
];

function OrbitLayer() {
  return (
    <div className="absolute inset-0 opacity-[0.4]">
      {RINGS.map((ring, i) => (
        <div
          key={`ring-${i}`}
          className="bgfx bg-spin absolute left-1/2 top-1/2 rounded-full border border-dashed border-[var(--amber-warm)]/60"
          style={
            {
              width: `${(ring.r * 2 * 100) / 1400}%`,
              aspectRatio: "1 / 0.46",
              "--bgr": `${ring.rot}deg`,
              "--bgp": `${60 + i * 20}s`,
            } as CSSProperties
          }
        />
      ))}
      {/* Node kecil yang mengorbit (translate di compositor) */}
      {RINGS.map((ring, i) => (
        <span
          key={`node-${i}`}
          className="bgfx bg-orbit absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
          style={
            {
              background: "var(--amber-warm)",
              "--rx": `${ring.r / 14}vw`,
              "--bgp": `${18 + i * 4}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------
 * Aurora — pita cahaya lembut yang bergeser perlahan
 * ---------------------------------------------------------------- */
const AURORA = [
  { top: "8%", left: "-10%", w: "95vw", h: "34vh", rot: -14, c: "var(--amber-warm)", a: 30, dur: 26 },
  { top: "34%", left: "20%", w: "90vw", h: "30vh", rot: 10, c: "var(--rose-warm)", a: 26, dur: 32 },
  { top: "58%", left: "-20%", w: "100vw", h: "32vh", rot: -6, c: "var(--amber-warm)", a: 20, dur: 38 },
];

function AuroraLayer() {
  return (
    <>
      {AURORA.map((r, i) => (
        <div
          key={i}
          className="bgfx bg-aurora absolute rounded-[50%]"
          style={
            {
              top: r.top,
              left: r.left,
              width: r.w,
              height: r.h,
              background: `radial-gradient(ellipse at center, color-mix(in srgb, ${r.c} ${r.a}%, transparent), transparent 68%)`,
              "--bgr": `${r.rot}deg`,
              "--bgp": `${r.dur}s`,
              "--bgd": `${-i * 7}s`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

/* ----------------------------------------------------------------
 * Gelombang — tiga lapis gelombang mengalir (translateX seamless)
 * ---------------------------------------------------------------- */
const WAVE_D =
  "M0 60 C150 20 150 20 300 60 S450 100 600 60 S750 20 900 60 S1050 100 1200 60 S1350 20 1500 60 S1650 100 1800 60 S1950 20 2100 60 S2250 100 2400 60 V140 H0 Z";
const WAVES = [
  { h: "30vh", o: 0.1, dur: 44, rev: false },
  { h: "24vh", o: 0.14, dur: 30, rev: true },
  { h: "17vh", o: 0.2, dur: 20, rev: false },
];

function WavesLayer() {
  return (
    <>
      {WAVES.map((w, i) => (
        <div
          key={i}
          className="absolute inset-x-0 bottom-0 overflow-hidden"
          style={{ height: w.h }}
        >
          <div
            className={`bgfx bg-wave h-full ${w.rev ? "bg-wave--rev" : ""}`}
            style={{ width: "200%", "--bgp": `${w.dur}s` } as CSSProperties}
          >
            <svg
              className="block h-full w-full"
              viewBox="0 0 2400 140"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d={WAVE_D}
                fill="var(--amber-warm)"
                fillOpacity={w.o}
                stroke="var(--amber-warm)"
                strokeOpacity={w.o * 3}
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>
      ))}
    </>
  );
}

/* ----------------------------------------------------------------
 * Wireframe 3D — kubus, berlian & segitiga kawat melayang
 * ---------------------------------------------------------------- */
const poly = (n: number, r: number, rot = 0, cx = 50, cy = 50) =>
  Array.from({ length: n })
    .map((_, i) => {
      const a = ((rot + (360 / n) * i) * Math.PI) / 180;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(" ");

function WireShape({ kind }: { kind: "cube" | "diamond" | "triangle" }) {
  const common = {
    fill: "none",
    stroke: "var(--amber-warm)",
    strokeWidth: 1.4,
    strokeLinejoin: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <svg viewBox="0 0 100 100" className="block h-full w-full" fill="none">
      {kind === "cube" && (
        <>
          <polygon points={poly(6, 42, -90)} {...common} />
          <polyline points="50,50 50,92" {...common} />
          <polyline points="50,50 13.6,29" {...common} />
          <polyline points="50,50 86.4,29" {...common} />
        </>
      )}
      {kind === "diamond" && (
        <>
          <polygon points="50,6 90,50 50,94 10,50" {...common} />
          <polyline points="10,50 90,50" {...common} />
          <polyline points="50,6 50,94" {...common} />
        </>
      )}
      {kind === "triangle" && (
        <>
          <polygon points="50,10 92,84 8,84" {...common} />
          <polygon points="50,34 70,70 30,70" {...common} strokeOpacity={0.6} />
        </>
      )}
    </svg>
  );
}

const WIRES: {
  kind: "cube" | "diamond" | "triangle";
  x: number;
  y: number;
  s: number;
  dur: number;
  spin: boolean;
}[] = [
  { kind: "cube", x: 12, y: 22, s: 84, dur: 13, spin: false },
  { kind: "triangle", x: 86, y: 18, s: 70, dur: 16, spin: true },
  { kind: "diamond", x: 8, y: 70, s: 58, dur: 11, spin: false },
  { kind: "cube", x: 90, y: 72, s: 76, dur: 15, spin: true },
  { kind: "triangle", x: 28, y: 88, s: 46, dur: 12, spin: false },
  { kind: "diamond", x: 74, y: 90, s: 52, dur: 14, spin: true },
  { kind: "cube", x: 50, y: 8, s: 40, dur: 10, spin: false },
];

function WireframeLayer() {
  return (
    <div className="absolute inset-0 opacity-[0.45]">
      {WIRES.map((w, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${w.x}%`,
            top: `${w.y}%`,
            width: w.s,
            height: w.s,
            marginLeft: -w.s / 2,
            marginTop: -w.s / 2,
          }}
        >
          <div
            className={`bgfx ${w.spin ? "bg-tumble" : "bg-float"} h-full w-full`}
            style={
              {
                "--bgp": `${w.dur}s`,
                "--bgd": `${-i * 1.7}s`,
              } as CSSProperties
            }
          >
            <WireShape kind={w.kind} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------
 * Sirkuit — jalur PCB dengan simpul berdenyut
 * ---------------------------------------------------------------- */
const TRACES = [
  "M0 150 H240 L290 200 H560 L600 160 H820",
  "M1400 120 H1150 L1100 170 H900",
  "M0 330 H180 L220 370 H420 V470 H640",
  "M1400 380 H1220 L1180 420 H1000 V520 H800",
  "M120 700 V610 L170 560 H380",
  "M1280 700 V620 L1230 570 H1060",
  "M520 0 V70 L560 110 H760 V40",
];
const PADS = [
  [820, 160], [900, 170], [640, 470], [800, 520], [380, 560], [1060, 570], [760, 40], [290, 200], [1100, 170],
];

function CircuitLayer() {
  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.5]"
        viewBox="0 0 1400 700"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        {TRACES.map((d, i) => (
          <path
            key={i}
            d={d}
            className="bgfx bg-draw"
            pathLength={1}
            stroke="var(--amber-warm)"
            strokeOpacity={0.55}
            strokeWidth={1.4}
            strokeLinejoin="round"
            style={{ "--bgd": `${i * 0.35}s`, "--bgt": "2.6s" } as CSSProperties}
          />
        ))}
        {PADS.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={5}
            stroke="var(--amber-warm)"
            strokeOpacity={0.6}
            strokeWidth={1.2}
          />
        ))}
      </svg>
      {PADS.map(([x, y], i) => (
        <span
          key={i}
          className="bgfx bg-pulse absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={
            {
              left: px(x),
              top: py(y),
              background: "var(--amber-warm)",
              "--bgp": `${2 + (i % 4) * 0.7}s`,
              "--bgd": `${i * 0.3}s`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

/* ----------------------------------------------------------------
 * Hujan Kode — kolom 0/1 jatuh perlahan
 * ---------------------------------------------------------------- */
const RAIN_COLS = Array.from({ length: 14 }).map((_, i) => {
  const len = 16 + ((i * 5) % 9);
  const text = Array.from({ length: len })
    .map((__, k) => ((i * 7 + k * 13 + (k % 3)) % 5 < 2 ? "1" : "0"))
    .join("\n");
  return {
    x: 3 + i * 7.1,
    text,
    dur: 11 + ((i * 3) % 9),
    delay: -((i * 2.3) % 14),
    y0: `${(i * 23) % 70}%`,
  };
});

function CodeRainLayer() {
  return (
    <div className="absolute inset-0 opacity-[0.4]">
      {RAIN_COLS.map((c, i) => (
        <div
          key={i}
          className="bgfx bg-rain absolute whitespace-pre font-mono text-[11px] leading-[14px]"
          style={
            {
              left: `${c.x}%`,
              top: c.y0,
              color: "var(--amber-warm)",
              "--bgp": `${c.dur}s`,
              "--bgd": `${c.delay}s`,
            } as CSSProperties
          }
        >
          {c.text}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------
 * Bokeh — lingkaran cahaya naik pelan
 * ---------------------------------------------------------------- */
const BOKEH = Array.from({ length: 16 }).map((_, i) => ({
  x: (i * 37 + 8) % 96,
  y: 58 + ((i * 17) % 40),
  s: 26 + ((i * 29) % 90),
  dur: 12 + ((i * 5) % 12),
  delay: -((i * 3.1) % 16),
  c: i % 3 === 0 ? "var(--rose-warm)" : "var(--amber-warm)",
}));

function BokehLayer() {
  return (
    <>
      {BOKEH.map((b, i) => (
        <div
          key={i}
          className="bgfx bg-bokeh absolute rounded-full"
          style={
            {
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: b.s,
              height: b.s,
              background: `radial-gradient(circle at 35% 35%, color-mix(in srgb, ${b.c} 45%, transparent), color-mix(in srgb, ${b.c} 12%, transparent) 60%, transparent 72%)`,
              border: `1px solid color-mix(in srgb, ${b.c} 22%, transparent)`,
              "--bgp": `${b.dur}s`,
              "--bgd": `${b.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

/* ----------------------------------------------------------------
 * Bintang Jatuh — goresan cahaya melintas diagonal
 * ---------------------------------------------------------------- */
const SHOOTERS = [
  { x: 8, y: 6, len: 190, dur: 9, delay: 0 },
  { x: 46, y: 2, len: 150, dur: 12, delay: -5 },
  { x: 72, y: 14, len: 210, dur: 10, delay: -2 },
  { x: 24, y: 30, len: 140, dur: 14, delay: -9 },
  { x: 88, y: 36, len: 170, dur: 11, delay: -7 },
  { x: 58, y: 44, len: 130, dur: 15, delay: -11 },
];

function ShootingStarsLayer() {
  return (
    <>
      {SHOOTERS.map((s, i) => (
        <div
          key={i}
          className="bgfx bg-shoot absolute h-px origin-left"
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.len,
              background:
                "linear-gradient(90deg, transparent, color-mix(in srgb, var(--amber-warm) 85%, white))",
              "--bgp": `${s.dur}s`,
              "--bgd": `${s.delay}s`,
            } as CSSProperties
          }
        />
      ))}
      {/* bintang diam sebagai latar */}
      {STARS.slice(0, 8).map((st, i) => (
        <span
          key={i}
          className="bgfx bg-twinkle absolute h-0.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={
            {
              left: px(st.x),
              top: py(st.y),
              background: "var(--amber-warm)",
              "--bgp": `${3 + (i % 4)}s`,
              "--bgd": `${i * 0.3}s`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

/* ----------------------------------------------------------------
 * Mandala Geometri — poligon konsentris berputar berlawanan
 * ---------------------------------------------------------------- */
function MandalaLayer() {
  const ring = (n: number, r: number, rot: number) => (
    <polygon
      key={`${n}-${r}`}
      points={poly(n, r, rot)}
      stroke="var(--amber-warm)"
      strokeWidth={0.6}
      vectorEffect="non-scaling-stroke"
    />
  );
  return (
    <div className="absolute inset-0 opacity-[0.45]">
      <div
        className="bgfx bg-spin absolute left-1/2 top-1/2"
        style={
          {
            width: "78vmin",
            height: "78vmin",
            "--bgp": "140s",
            "--bgr": "0deg",
          } as CSSProperties
        }
      >
        <svg viewBox="0 0 100 100" className="block h-full w-full" fill="none">
          {ring(12, 48, 0)}
          {ring(12, 48, 15)}
          {ring(8, 38, 22.5)}
          {ring(8, 38, 0)}
          <circle cx={50} cy={50} r={48} stroke="var(--amber-warm)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" strokeDasharray="1 2" />
        </svg>
      </div>
      <div
        className="bgfx bg-spin bg-spin--rev absolute left-1/2 top-1/2"
        style={
          {
            width: "54vmin",
            height: "54vmin",
            "--bgp": "90s",
            "--bgr": "0deg",
          } as CSSProperties
        }
      >
        <svg viewBox="0 0 100 100" className="block h-full w-full" fill="none">
          {ring(6, 46, 0)}
          {ring(6, 46, 30)}
          {ring(3, 34, -90)}
          {ring(3, 34, 90)}
          <circle cx={50} cy={50} r={14} stroke="var(--amber-warm)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
 * Sparkle global — kilauan cahaya berdenyut lembut
 * ---------------------------------------------------------------- */
const SPARKS = Array.from({ length: 14 }).map((_, i) => ({
  x: (i * 97) % 100,
  y: (i * 53) % 100,
  d: 1.8 + ((i * 7) % 10) / 4,
  delay: (i % 7) * 0.4,
}));

function Sparkles() {
  return (
    <div className="absolute inset-0">
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="bgfx bg-spark absolute h-1 w-1 rounded-full"
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              background: "var(--amber-warm)",
              boxShadow:
                "0 0 6px 1px color-mix(in srgb, var(--amber-warm) 50%, transparent)",
              "--bgp": `${s.d}s`,
              "--bgd": `${s.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------
 * Designer Cursor — kursor desainer virtual yang melayang pelan
 * ---------------------------------------------------------------- */
function DesignerCursor() {
  return (
    <div className="bgfx bg-cursor absolute left-0 top-0">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path
          d="M3 3 L3 16 L7 12.5 L9.5 19 L12 18 L9.5 11.5 L15 11.5 Z"
          fill="var(--canvas-bg, oklch(0.12 0.02 270))"
          stroke="var(--amber-warm)"
          strokeWidth="1"
        />
      </svg>
      <span className="absolute left-5 top-5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.15em] text-amber-warm/60">
        pen-tool
      </span>
    </div>
  );
}
