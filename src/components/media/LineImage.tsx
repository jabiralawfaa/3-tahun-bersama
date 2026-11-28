"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * LineImage
 * ------------------------------------------------------------------
 * Gambar dari pustaka Media yang tampil di slot ikon sebuah baris.
 * Masuk: fade + zoom + geser halus dari sisinya; keluar: memudar.
 * Hanya transform/opacity (ringan). Gambar baru tampil setelah selesai
 * dimuat agar tidak "pop-in" setengah jadi. Gaya: .kl-img* di globals.css.
 * ------------------------------------------------------------------ */
interface LineImageProps {
  src: string;
  side?: "left" | "right";
  phase?: "in" | "out";
  /** "cell" = kolom ikon mode LRC; "hero" = di atas ucapan (mode biasa). */
  variant?: "cell" | "hero";
  alt?: string;
}

export function LineImage({
  src,
  side = "left",
  phase = "in",
  variant = "cell",
  alt = "",
}: LineImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);

  // Gambar yang sudah ada di cache bisa selesai sebelum onLoad terpasang.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  const on = mounted && loaded && phase === "in";

  return (
    <div
      className={`kl-img kl-img--${variant} ${side === "right" ? "kl-img--right" : ""} ${
        on ? "is-on" : ""
      }`}
      style={{ "--kl-img-rot": side === "right" ? "2deg" : "-2deg" } as CSSProperties}
      aria-hidden={alt ? undefined : true}
    >
      <div className="kl-img-idle">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(false)}
        />
      </div>
    </div>
  );
}
