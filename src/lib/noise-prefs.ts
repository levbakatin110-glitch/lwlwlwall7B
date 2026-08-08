"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NoiseKind } from "@/lib/noise-engine";

type NoisePrefs = {
  kind: NoiseKind;
  volume: number;
  /** минуты таймера по умолчанию; 0 = без ограничения */
  defaultMinutes: number;
  setKind: (kind: NoiseKind) => void;
  setVolume: (volume: number) => void;
  setDefaultMinutes: (minutes: number) => void;
};

export const useNoisePrefs = create<NoisePrefs>()(
  persist(
    (set) => ({
      kind: "pink",
      volume: 0.45,
      defaultMinutes: 30,
      setKind: (kind) => set({ kind }),
      setVolume: (volume) => set({ volume }),
      setDefaultMinutes: (defaultMinutes) => set({ defaultMinutes }),
    }),
    { name: "maya-noise-prefs" },
  ),
);

export const TIMER_OPTIONS = [
  { minutes: 0, label: "∞" },
  { minutes: 15, label: "15м" },
  { minutes: 30, label: "30м" },
  { minutes: 45, label: "45м" },
  { minutes: 60, label: "1ч" },
  { minutes: 90, label: "1.5ч" },
] as const;
