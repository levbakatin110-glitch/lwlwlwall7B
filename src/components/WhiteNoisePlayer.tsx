"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MayaIcon } from "@/components/icons/MayaIcon";
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

export function WhiteNoisePlayer() {
  const kind = useNoisePrefs((s) => s.kind);
  const volume = useNoisePrefs((s) => s.volume);
  const defaultMinutes = useNoisePrefs((s) => s.defaultMinutes);
  const setKindPref = useNoisePrefs((s) => s.setKind);
  const setVolumePref = useNoisePrefs((s) => s.setVolume);
  const setDefaultMinutes = useNoisePrefs((s) => s.setDefaultMinutes);

  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remain, setRemain] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFired = useRef(false);

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

  function clearLongPress() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function onFabPointerDown() {
    longPressFired.current = false;
    clearLongPress();
    longPressRef.current = window.setTimeout(() => {
      longPressFired.current = true;
      setOpen(true);
    }, 420);
  }

  function onFabPointerUp() {
    const wasLong = longPressFired.current;
    clearLongPress();
    if (!wasLong) void quickToggle();
  }

  function onFabPointerCancel() {
    clearLongPress();
  }

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
    <div className="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-end gap-2 md:bottom-5 md:right-5">
      {open && (
        <div
          className="pointer-events-auto maya-rise w-[min(100vw-1.5rem,20.5rem)] overflow-hidden rounded-[1.35rem] border border-line bg-card/95 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          role="dialog"
          aria-label="Шум для сна"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Для мам
              </p>
              <h2 className="font-display mt-0.5 text-lg font-semibold tracking-tight">
                Шум для сна
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-sm text-muted hover:text-foreground"
              aria-label="Свернуть"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {NOISE_PRESETS.map((p) => {
              const active = kind === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void onKind(p.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-accent/40 bg-accent-soft"
                      : "border-line bg-background/60 hover:border-accent/25"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">{p.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">
                    {p.hint}
                  </p>
                </button>
              );
            })}
          </div>

          <label className="mt-4 block">
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

          <div className="mt-4">
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
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition disabled:opacity-50 ${
              playing
                ? "bg-user-bubble text-foreground ring-1 ring-line"
                : "bg-accent text-[#ffffff] hover:bg-accent-hot"
            }`}
          >
            <NoiseWaveIcon playing={playing} />
            {playing ? "Пауза" : "Включить"}
          </button>
        </div>
      )}

      <div className="pointer-events-auto flex items-center gap-2">
        <Link
          href="/community"
          aria-label="Общение — чат с другими в Мае"
          title="Общение"
          className="flex h-14 w-14 flex-col items-center justify-center rounded-full border border-line bg-card/95 text-foreground shadow-lg backdrop-blur-xl transition hover:border-accent/40 hover:bg-accent-soft"
        >
          <MayaIcon name="circle" size={20} className="text-accent" />
          <span className="mt-0.5 text-[9px] font-semibold leading-none text-muted">
            чат
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-line bg-card/90 px-3 py-2 text-[11px] font-medium text-muted backdrop-blur-md hover:text-foreground"
        >
          {open
            ? "свернуть"
            : playing && remain
              ? `шум · ${remain}`
              : playing
                ? "настроить"
                : "шум · настройки"}
        </button>
        <button
          type="button"
          disabled={busy}
          onPointerDown={onFabPointerDown}
          onPointerUp={onFabPointerUp}
          onPointerLeave={onFabPointerCancel}
          onPointerCancel={onFabPointerCancel}
          onContextMenu={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          aria-label={playing ? "Выключить шум" : "Включить шум"}
          title="Нажмите — вкл/выкл · удерживайте — настройки"
          className={`relative flex h-14 w-14 items-center justify-center rounded-full border shadow-lg transition disabled:opacity-60 ${
            playing
              ? "maya-noise-pulse border-accent/50 bg-accent text-[#ffffff]"
              : "border-line bg-card/95 text-foreground backdrop-blur-xl hover:border-accent/40"
          }`}
        >
          <NoiseWaveIcon playing={playing} />
        </button>
      </div>
    </div>
  );
}

function NoiseWaveIcon({ playing }: { playing: boolean }) {
  return (
    <svg
      width="22"
      height="22"
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
