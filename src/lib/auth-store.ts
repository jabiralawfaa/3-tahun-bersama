/**
 * lib/auth-store.ts
 * ------------------------------------------------------------------
 * State proteksi sederhana berbasis Zustand + sessionStorage.
 *
 * Menyimpan daftar slug yang sudah "di-unlock" lewat halaman gerbang `/`.
 * Halaman /for/[slug] memeriksa apakah slug sudah di-unlock sebelum
 * menampilkan konten; bila belum, diarahkan kembali ke `/`.
 *
 * Catatan: ini proteksi state client-side (bukan keamanan server),
 * sesuai permintaan agar halaman tidak bisa dibuka langsung via URL
 * tanpa melewati gerbang.
 * ------------------------------------------------------------------ */
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AuthState {
  /** Daftar slug yang sudah di-unlock pada sesi ini */
  unlocked: string[];
  /** Apakah store sudah selesai rehidrasi dari sessionStorage? */
  _hasHydrated: boolean;
  /** Tandai slug sebagai sudah di-unlock */
  unlock: (slug: string) => void;
  /** Apakah slug tertentu sudah di-unlocked? */
  isUnlocked: (slug: string) => boolean;
  /** Reset seluruh sesi (keluar) */
  reset: () => void;
  /** Tandai rehidrasi selesai (dipanggil middleware) */
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      unlocked: [],
      _hasHydrated: false,
      unlock: (slug) =>
        set((state) =>
          state.unlocked.includes(slug)
            ? state
            : { unlocked: [...state.unlocked, slug] },
        ),
      isUnlocked: (slug) => get().unlocked.includes(slug),
      reset: () => set({ unlocked: [] }),
      setHydrated: () => set({ _hasHydrated: true }),
    }),
    {
      name: "arsip-auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? sessionStorage
          : (undefined as never),
      ),
      // Hanya persist daftar unlocked; flag hidrasi tidak disimpan.
      partialize: (state) => ({ unlocked: state.unlocked }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
