"use client";

import { useEffect, useState } from "react";
import {
  NOISE_PRESETS,
  noiseEngine,
  type NoiseKind,
} from "@/lib/noise-engine";
import { TIMER_OPTIONS, useNoisePrefs } from "@/lib/noise-prefs";

function formatRemain(endsAt: number | null): string | null {
  if (!endsAt) return null;
  const ms = Math.max(0, endsAt - Date.now());
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function NoiseWaveIcon({
  playing,
  size = 22,
}: {
  playing: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      {playing ? (
        <>
          <path d="M8 7v10" />
          <path d="M16 7v10" />
        </>
      ) : (
        <>
          <path d="M4.5 12h0.01" />
          <path d="M8 8.5v7" />
          <path d="M12 6v12" />
          <path d="M16 8.5v7" />
          <path d="M19.5 12h0.01" />
        </>
      )}
    </svg>
  );
}

/** Шум для сна — виджет (не дневник), общий engine */
export function WhiteNoiseWidget({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const kind = useNoisePrefs((s) => s.kind);
  const volume = useNoisePrefs((s) => s.volume);
  const defaultMinutes = useNoisePrefs((s) => s.defaultMinutes);
  const setKindPref = useNoisePrefs((s) => s.setKind);
  const setVolumePref = useNoisePrefs((s) => s.setVolume);
  const setDefaultMinutes = useNoisePrefs((s) => s.setDefaultMinutes);

  const [playing, setPlaying] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remain, setRemain] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return noiseEngine.subscribe((s) => {
      setPlaying(s.playing);
      setEndsAt(s.endsAt);
    });
  }, []);

  useEffect(() => {
    if (!endsAt) {
      setRemain(null);
      return;
    }
    const tick = () => setRemain(formatRemain(endsAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  async function quickToggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (playing) {
        noiseEngine.stop();
      } else {
        await noiseEngine.play({
          kind,
          volume,
          minutes: defaultMinutes > 0 ? defaultMinutes : null,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function onKind(next: NoiseKind) {
    setKindPref(next);
    await noiseEngine.setKind(next);
    if (!playing) {
      setBusy(true);
      try {
        await noiseEngine.play({
          kind: next,
          volume,
          minutes: defaultMinutes > 0 ? defaultMinutes : null,
        });
      } finally {
        setBusy(false);
      }
    }
  }

  function onVolume(v: number) {
    setVolumePref(v);
    noiseEngine.setVolume(v);
  }

  function onTimer(minutes: number) {
    setDefaultMinutes(minutes);
    if (playing) {
      noiseEngine.setTimer(minutes > 0 ? minutes : null);
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-line bg-card/90 ${
        compact ? "p-3.5" : "p-4"
      } ${className}`}
      role="region"
      aria-label="Шум для сна — виджет"
    >
      <div className="flex items-start justify-between gap-3">
        {!compact ? (
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
              Шум для сна
            </h3>
          </div>
        ) : (
          <p className="min-w-0 text-sm text-muted">Выберите звук и таймер</p>
        )}
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            playing
              ? "bg-accent text-[var(--on-accent,#fff)]"
              : "bg-accent-soft text-accent"
          }`}
          aria-hidden
        >
          <NoiseWaveIcon playing={playing} size={20} />
        </span>
      </div>

      <div className={`grid grid-cols-2 gap-2 ${compact ? "mt-3" : "mt-3.5"}`}>
        {NOISE_PRESETS.map((p) => {
          const active = kind === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => void onKind(p.id)}
              className={`rounded-xl border px-2.5 py-2 text-left transition ${
                active
                  ? "border-accent/40 bg-accent-soft"
                  : "border-line bg-background/60 hover:border-accent/25"
              }`}
            >
              <p className="text-sm font-semibold text-foreground">{p.label}</p>
            </button>
          );
        })}
      </div>

      <label className="mt-3 block">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
          <span>Громкость</span>
          <span className="font-mono">{Math.round(volume * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
          className="maya-noise-range w-full"
          aria-label="Громкость"
        />
      </label>

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] text-muted">Таймер</p>
        <div className="flex flex-wrap gap-1.5">
          {TIMER_OPTIONS.map((t) => {
            const active = defaultMinutes === t.minutes;
            return (
              <button
                key={t.minutes}
                type="button"
                onClick={() => onTimer(t.minutes)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-accent text-[#ffffff]"
                    : "border border-line bg-background/50 text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {playing && remain && (
          <p className="mt-2 font-mono text-[11px] text-accent">
            осталось {remain}
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void quickToggle()}
        className={`mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition disabled:opacity-50 ${
          playing
            ? "bg-user-bubble text-foreground ring-1 ring-line"
            : "bg-accent text-[#ffffff] hover:bg-accent-hot"
        }`}
      >
        <NoiseWaveIcon playing={playing} size={18} />
        {playing ? "Пауза" : "Включить"}
      </button>
    </div>
  );
}
