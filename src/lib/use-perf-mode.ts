"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * usePerfMode
 * ------------------------------------------------------------------
 * Mode kualitas animasi untuk PC/laptop lama.
 *
 *  - "auto"  : mulai di kualitas penuh. Bila FPS saat lagu diputar
 *              terus di bawah ±38 fps, otomatis pindah ke mode ringan
 *              dan diingat untuk kunjungan berikutnya.
 *  - "low"   : paksa ringan.
 *  - "high"  : paksa penuh (abaikan deteksi).
 *
 * Mode ringan dipasang sebagai atribut data-perf="low" pada <main>;
 * seluruh penyederhanaan (tanpa blur/glow animasi, tanpa gerak idle,
 * tanpa condong 3D, tanpa backdrop-blur) ada di globals.css.
 * ------------------------------------------------------------------ */
export type PerfPref = "auto" | "low" | "high";

const PREF_KEY = "kenangan:perf-pref";
const AUTO_KEY = "kenangan:perf-auto-low";

const SLOW_FRAME_MS = 26; // rata-rata > 26 ms ≈ < 38 fps
const WINDOW_FRAMES = 90; // jendela ukur ≈ 1,5 dtk pada 60 fps
const STRIKES_TO_DEGRADE = 2;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage diblokir — abaikan */
  }
}

export function usePerfMode() {
  const [pref, setPrefState] = useState<PerfPref>("auto");
  const [autoLow, setAutoLow] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Baca preferensi tersimpan + prefers-reduced-motion setelah mount.
  useEffect(() => {
    const p = readStorage(PREF_KEY);
    if (p === "low" || p === "high" || p === "auto") setPrefState(p);
    if (readStorage(AUTO_KEY) === "1") setAutoLow(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setPref = useCallback((p: PerfPref) => {
    setPrefState(p);
    writeStorage(PREF_KEY, p);
    if (p === "auto") {
      // Mulai ulang deteksi otomatis dari nol.
      setAutoLow(false);
      writeStorage(AUTO_KEY, "0");
    }
  }, []);

  // --- Pengukur FPS (dipanggil dari loop rAF halaman, hanya saat main) ---
  const acc = useRef({ sum: 0, n: 0, strikes: 0 });
  const prefRef = useRef(pref);
  const autoLowRef = useRef(autoLow);
  useEffect(() => {
    prefRef.current = pref;
    autoLowRef.current = autoLow;
  }, [pref, autoLow]);

  const reportFrame = useCallback((dt: number) => {
    if (prefRef.current !== "auto" || autoLowRef.current) return;
    if (dt <= 0 || dt > 250) {
      // tab disembunyikan / jeda panjang — jangan dihitung
      acc.current = { sum: 0, n: 0, strikes: acc.current.strikes };
      return;
    }
    const a = acc.current;
    a.sum += dt;
    a.n += 1;
    if (a.n < WINDOW_FRAMES) return;
    const avg = a.sum / a.n;
    a.sum = 0;
    a.n = 0;
    if (avg > SLOW_FRAME_MS) {
      a.strikes += 1;
      if (a.strikes >= STRIKES_TO_DEGRADE) {
        setAutoLow(true);
        writeStorage(AUTO_KEY, "1");
      }
    } else {
      a.strikes = 0;
    }
  }, []);

  const low = pref === "low" || (pref === "auto" && (autoLow || reduced));
  return { pref, setPref, low, autoLow, reportFrame };
}
