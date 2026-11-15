"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { DecorationKind } from "@/data/memories";

/**
 * AnimatedBackground
 * ------------------------------------------------------------------
 * Lapisan dekoratif SVG beranimasi yang memperkuat identitas
 * mahasiswa IT & desainer (Figma design canvas):
 *   - Bezier Curves & Vector Nodes : self-drawing pen-tool paths
 *   - Constellation / Starlight    : rasi bintang + kilauan sparkle
 *   - Floating Wireframe / Orbit   : lingkaran orbit + kursor desainer
 *
 * Semua dibuat inline SVG agar pathLength & morph bisa dianimasikan.
 * Tidak mengganggu keterbacaan teks utama (opacity rendah, di latar).
 * ------------------------------------------------------------------
 */
interface AnimatedBackgroundProps {
  decoration: DecorationKind;
  /** Indeks baris lirik aktif, untuk menggerakkan dekorasi saat bait berganti */
  activeBait?: number;
}

export function AnimatedBackground({
  decoration,
  activeBait = 0,
}: AnimatedBackgroundProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Dot grid canvas */}
      <div className="absolute inset-0 bg-dot-grid-fine opacity-70" />

      {/* Aura hangat yang bergerak perlahan */}
      <motion.div
        className="absolute -top-1/4 left-1/2 h-[60rem] w-[60rem] -translate-x-1/2 glow-amber"
        animate={{ scale: [1, 1.12, 1], opacity: [0.55, 0.75, 0.55] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-20%] right-[-10%] h-[48rem] w-[48rem] glow-rose"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Layer dekorasi utama sesuai tema */}
      {decoration === "bezier" && <BezierLayer activeBait={activeBait} />}
      {decoration === "constellation" && (
        <ConstellationLayer activeBait={activeBait} />
      )}
      {decoration === "orbit" && <OrbitLayer activeBait={activeBait} />}

      {/* Sparkle global — selalu hadir, berdenyut lembut */}
      <Sparkles activeBait={activeBait} />

      {/* Cursor desainer virtual yang melayang */}
      <DesignerCursor activeBait={activeBait} />

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
}

/* ----------------------------------------------------------------
 * Bezier Curves & Vector Nodes — self-drawing pen-tool paths
 * ---------------------------------------------------------------- */
function BezierLayer({ activeBait }: { activeBait: number }) {
  const paths = useMemo(
    () => [
      "M 40 320 C 180 120, 420 520, 680 220 S 1180 80, 1320 320",
      "M 60 540 C 220 360, 520 640, 820 380 S 1240 300, 1340 520",
      "M 120 140 C 360 60, 540 300, 860 180 S 1180 420, 1280 200",
    ],
    [],
  );

  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.45]"
      viewBox="0 0 1400 700"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      {paths.map((d, i) => (
        <g key={i}>
          <motion.path
            d={d}
            stroke="oklch(0.78 0.14 65)"
            strokeWidth={1.25}
            strokeDasharray="2 6"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: 1,
              opacity: 0.5 + (activeBait % 3) * 0.12,
            }}
            transition={{
              pathLength: { duration: 3.5, delay: i * 0.4, ease: "easeInOut" },
              opacity: { duration: 1.2, delay: i * 0.4 },
            }}
          />
          {/* Anchor nodes di sepanjang path */}
          <BezierNodes d={d} index={i} activeBait={activeBait} />
        </g>
      ))}
    </svg>
  );
}

function BezierNodes({
  d,
  index,
  activeBait,
}: {
  d: string;
  index: number;
  activeBait: number;
}) {
  // Posisi anchor node diturunkan dari koordinat kasar pada path.
  const nodes = useMemo(() => {
    const base = [
      { x: 40 + index * 30, y: 320 + index * 10 },
      { x: 680 + index * 20, y: 220 + index * 40 },
      { x: 1320 - index * 20, y: 320 + index * 30 },
    ];
    return base;
  }, [index]);

  return (
    <>
      {nodes.map((n, i) => (
        <motion.g
          key={i}
          animate={{
            opacity: [0.35, 0.85, 0.35],
            scale: [0.9, 1.15, 0.9],
          }}
          transition={{
            duration: 3 + i * 0.6 + activeBait * 0.05,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.3 + i * 0.4,
          }}
        >
          <rect
            x={n.x - 4}
            y={n.y - 4}
            width={8}
            height={8}
            rx={1.5}
            fill="oklch(0.12 0.02 270)"
            stroke="oklch(0.78 0.14 65)"
            strokeWidth={1.25}
          />
          {/* Garis handle pen-tool */}
          <motion.line
            x1={n.x}
            y1={n.y}
            x2={n.x + (i % 2 === 0 ? 36 : -36)}
            y2={n.y + (i % 2 === 0 ? 24 : -24)}
            stroke="oklch(0.78 0.14 65 / 0.4)"
            strokeWidth={0.75}
            strokeDasharray="2 3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: i * 0.2 }}
          />
        </motion.g>
      ))}
    </>
  );
}

/* ----------------------------------------------------------------
 * Constellation / Starlight — rasi bintang geometris + sparkle
 * ---------------------------------------------------------------- */
function ConstellationLayer({ activeBait }: { activeBait: number }) {
  const stars = useMemo(
    () => [
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
    ],
    [],
  );

  // Hubungkan beberapa bintang membentuk "rasi"
  const lines = useMemo(
    () => [
      [stars[0], stars[1], stars[3], stars[5]],
      [stars[2], stars[4], stars[6], stars[7]],
      [stars[8], stars[9], stars[10], stars[11]],
    ],
    [stars],
  );

  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.5]"
      viewBox="0 0 1400 700"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      {lines.map((pathStars, li) => (
        <motion.polyline
          key={li}
          points={pathStars.map((s) => `${s.x},${s.y}`).join(" ")}
          stroke="oklch(0.82 0.12 70 / 0.5)"
          strokeWidth={0.8}
          strokeDasharray="3 5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: 1,
            opacity: 0.4 + ((activeBait + li) % 3) * 0.15,
          }}
          transition={{
            pathLength: { duration: 2.8, delay: li * 0.5, ease: "easeInOut" },
            opacity: { duration: 1, delay: li * 0.5 },
          }}
        />
      ))}
      {stars.map((s, i) => (
        <motion.g
          key={i}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{
            duration: 2.4 + (i % 5) * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.18,
          }}
        >
          <circle cx={s.x} cy={s.y} r={1.6} fill="oklch(0.85 0.1 70)" />
          <circle
            cx={s.x}
            cy={s.y}
            r={4}
            fill="oklch(0.82 0.12 70 / 0.12)"
          />
        </motion.g>
      ))}
    </svg>
  );
}

/* ----------------------------------------------------------------
 * Floating Wireframe / Orbit Rings — lingkaran orbit tipis 3D
 * ---------------------------------------------------------------- */
function OrbitLayer({ activeBait }: { activeBait: number }) {
  const rings = useMemo(
    () => [
      { cx: 700, cy: 350, r: 240, rot: 0 },
      { cx: 700, cy: 350, r: 320, rot: 24 },
      { cx: 700, cy: 350, r: 420, rot: 48 },
      { cx: 700, cy: 350, r: 180, rot: 72 },
    ],
    [],
  );

  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.4]"
      viewBox="0 0 1400 700"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      {rings.map((ring, i) => (
        <motion.ellipse
          key={i}
          cx={ring.cx}
          cy={ring.cy}
          rx={ring.r}
          ry={ring.r * (0.42 + ((activeBait + i) % 3) * 0.04)}
          stroke="oklch(0.78 0.14 65 / 0.35)"
          strokeWidth={0.8}
          strokeDasharray="2 7"
          animate={{ rotate: ring.rot + 360 }}
          transition={{
            duration: 60 + i * 20,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{ transformOrigin: `${ring.cx}px ${ring.cy}px` }}
        />
      ))}
      {/* Node kecil yang mengorbit */}
      {rings.map((ring, i) => (
        <motion.circle
          key={`node-${i}`}
          r={3}
          fill="oklch(0.82 0.14 65)"
          animate={{
            cx: [ring.cx - ring.r, ring.cx + ring.r, ring.cx - ring.r],
            cy: [
              ring.cy,
              ring.cy - ring.r * 0.4,
              ring.cy,
            ],
          }}
          transition={{
            duration: 18 + i * 4,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </svg>
  );
}

/* ----------------------------------------------------------------
 * Sparkle global — kilauan cahaya berdenyut lembut
 * ---------------------------------------------------------------- */
function Sparkles({ activeBait }: { activeBait: number }) {
  const sparks = useMemo(() => {
    const seed = activeBait;
    return Array.from({ length: 14 }).map((_, i) => ({
      x: ((i * 97 + seed * 31) % 100),
      y: ((i * 53 + seed * 17) % 100),
      d: 1.8 + ((i * 7) % 10) / 4,
      delay: (i % 7) * 0.4,
    }));
  }, [activeBait]);

  return (
    <div className="absolute inset-0">
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            background: "oklch(0.85 0.12 70)",
            boxShadow: "0 0 6px 1px oklch(0.82 0.12 70 / 0.5)",
          }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.5, 1.3, 0.5] }}
          transition={{
            duration: s.d,
            repeat: Infinity,
            ease: "easeInOut",
            delay: s.delay,
          }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------
 * Designer Cursor — kursor desainer virtual yang melayang pelan
 * ---------------------------------------------------------------- */
function DesignerCursor({ activeBait }: { activeBait: number }) {
  return (
    <motion.div
      className="absolute"
      initial={{ x: "20vw", y: "30vh" }}
      animate={{
        x: ["22vw", "68vw", "48vw", "22vw"],
        y: ["28vh", "42vh", "62vh", "28vh"],
      }}
      transition={{
        duration: 26 + activeBait,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path
          d="M3 3 L3 16 L7 12.5 L9.5 19 L12 18 L9.5 11.5 L15 11.5 Z"
          fill="oklch(0.12 0.02 270)"
          stroke="oklch(0.85 0.12 70)"
          strokeWidth="1"
        />
      </svg>
      <motion.span
        className="absolute left-5 top-5 font-mono text-[9px] uppercase tracking-[0.15em] text-amber-warm/60"
        animate={{ opacity: [0.2, 0.7, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        pen-tool
      </motion.span>
    </motion.div>
  );
}
