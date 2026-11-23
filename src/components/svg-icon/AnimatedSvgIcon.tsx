"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { parseSvg, type SvgIcon, type SvgNode } from "@/lib/svg";

/**
 * AnimatedSvgIcon
 * ------------------------------------------------------------------
 * Menampilkan satu ikon SVG dengan animasi masuk → idle → keluar.
 *
 *  - mode "outline": garis tepi menggambar dirinya (stroke-dashoffset)
 *    bergaya neon + glow + kedip halus.
 *  - mode "fill"   : outline tergambar lalu area di dalamnya terisi dari
 *    bawah ke atas (clip-path), lalu "bernapas".
 *
 * Keluar: pemanggil mengganti prop `phase` ke "out" lalu melepas elemen
 * setelah ±0,9 dtk (undraw / drain berjalan lewat transition CSS).
 *
 * Semua gaya ada di globals.css (kelas .svgi-*).
 * ------------------------------------------------------------------ */

interface AnimatedSvgIconProps {
  icon: SvgIcon;
  /** Sisi tempat ikon berada: menentukan arah masuk/keluar & ayunan. */
  side?: "left" | "right";
  /** Ukuran (lebar = tinggi). Angka = px, atau string CSS mis. clamp(...). */
  size?: number | string;
  /** Fase animasi: "in" (masuk + idle) atau "out" (keluar). Default "in". */
  phase?: "in" | "out";
  /** Tunda animasi masuk (ms) — untuk muncul bergiliran (stagger). */
  delay?: number;
  className?: string;
}

export function AnimatedSvgIcon({
  icon,
  side = "left",
  size = 96,
  phase = "in",
  delay = 0,
  className = "",
}: AnimatedSvgIconProps) {
  const parsed = useMemo(() => parseSvg(icon.svg), [icon.svg]);

  // `on` menyala satu-dua frame setelah mount agar transition CSS berjalan.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    let r2 = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        if (delay > 0) timer = setTimeout(() => setMounted(true), delay);
        else setMounted(true);
      });
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!parsed.ok) return null;
  const { viewBox, nodes } = parsed.value;
  const [vx, vy, vw, vh] = viewBox;

  const on = mounted && phase === "in";

  // Tebal garis proporsional dengan ukuran viewBox (24 → 1.5).
  const sw = (Math.max(vw, vh) / 24) * 1.5;
  const style = {
    "--svgi-size": typeof size === "number" ? `${size}px` : size,
    "--sw": sw,
    ...(icon.color ? { "--ic": icon.color } : null),
    aspectRatio: `${vw} / ${vh}`,
  } as CSSProperties;

  const counter = { n: 0 };
  const strokeLayer = (
    <g className="svgi-stroke">{renderNodes(nodes, counter)}</g>
  );
  counter.n = 0;
  const fillLayer =
    icon.mode === "fill" ? (
      <g className="svgi-fill">{renderNodes(nodes, counter)}</g>
    ) : null;

  return (
    <div
      className={`svgi svgi--${icon.mode} ${side === "right" ? "svgi--right" : ""} ${
        on ? "is-on" : ""
      } ${className}`}
      style={style}
      aria-hidden="true"
    >
      <div className="svgi-pop">
        <div className="svgi-idle">
          <svg
            className="svgi-svg"
            viewBox={`${vx} ${vy} ${vw} ${vh}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            {fillLayer}
            {strokeLayer}
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ---------- pohon whitelist → elemen React ---------- */
const ATTR_MAP: Record<string, string> = { "fill-rule": "fillRule" };

function renderNodes(
  nodes: SvgNode[],
  counter: { n: number },
): React.ReactNode[] {
  return nodes.map((node, k) => {
    const props: Record<string, string> = {};
    for (const [name, value] of Object.entries(node.attrs)) {
      props[ATTR_MAP[name] ?? name] = value;
    }
    if (node.tag === "g") {
      return (
        <g key={k} {...props}>
          {renderNodes(node.children, counter)}
        </g>
      );
    }
    const i = counter.n++;
    const Tag = node.tag as "path";
    return (
      <Tag
        key={k}
        {...props}
        className="svgi-s"
        pathLength={1}
        style={{ "--i": i } as CSSProperties}
      />
    );
  });
}
