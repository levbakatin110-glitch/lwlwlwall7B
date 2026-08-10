"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";

const SS_KEY = "maya-walk-session";
const QUICK = [15, 30, 45, 60, 90] as const;

type Session = {
  startedAt: number;
  place: string;
};

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function formatDur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function WalkTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const entries = useAppStore((s) => s.journals.walk ?? []);
  const [session, setSession] = useState<Session | null>(null);
  const [tick, setTick] = useState(0);
  const [place, setPlace] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [session]);

  const elapsedSec = session
    ? Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000) + tick * 0)
    : 0;
  // recompute from Date.now on each tick
  const liveSec = session
    ? Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000))
    : 0;
  void tick;

  const todayMin = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return entries
      .filter((e) => e.date === today)
      .reduce((sum, e) => {
        const fromField = Number(e.fields?.totalMin);
        if (Number.isFinite(fromField)) return sum + fromField;
        const m = e.value.match(/(\d+)\s*мин/i);
        return sum + (m ? Number(m[1]) : 0);
      }, 0);
  }, [entries]);

  function start() {
    const next: Session = {
      startedAt: Date.now(),
      place: place.trim(),
    };
    sessionStorage.setItem(SS_KEY, JSON.stringify(next));
    setSession(next);
  }

  function stopAndSave() {
    if (!session) return;
    const totalSec = Math.max(30, Math.floor((Date.now() - session.startedAt) / 1000));
    const totalMin = Math.max(1, Math.round(totalSec / 60));
    const placeLabel = (session.place || place).trim();
    const value = placeLabel
      ? `${totalMin} мин · ${placeLabel}`
      : `${totalMin} мин`;
    addJournalEntry("walk", {
      date: new Date().toISOString().slice(0, 10),
      value,
      note: "",
      fields: {
        totalSec,
        totalMin,
        place: placeLabel,
      },
    });
    sessionStorage.removeItem(SS_KEY);
    setSession(null);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  }

  function quickSave(min: number) {
    const placeLabel = place.trim();
    const value = placeLabel ? `${min} мин · ${placeLabel}` : `${min} мин`;
    addJournalEntry("walk", {
      date: new Date().toISOString().slice(0, 10),
      value,
      note: "",
      fields: {
        totalSec: min * 60,
        totalMin: min,
        place: placeLabel,
      },
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  }

  return (
    <div className="maya-rise overflow-hidden rounded-[1.5rem] border border-line bg-card/80 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Прогулка
          </h2>
          <p className="mt-1 text-xs text-muted">
            Сегодня уже ~{todayMin} мин на воздухе
          </p>
        </div>
      </div>

      <label className="mt-4 block text-sm">
        <span className="text-xs text-muted">Где гуляете (по желанию)</span>
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="двор, парк, коляска…"
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
          disabled={!!session}
        />
      </label>

      {session ? (
        <div className="mt-5 rounded-2xl border border-accent/25 bg-accent-soft/50 px-4 py-5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Идём
          </p>
          <p className="font-display mt-2 text-5xl font-semibold tabular-nums tracking-tight">
            {formatDur(liveSec || elapsedSec)}
          </p>
          <button
            type="button"
            onClick={stopAndSave}
            className="mt-4 w-full rounded-2xl bg-accent py-3 text-sm font-semibold text-on-accent"
          >
            {savedFlash ? "Сохранено ✓" : "Закончить и записать"}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={start}
            className="mt-4 w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-on-accent"
          >
            Начать прогулку
          </button>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {QUICK.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => quickSave(m)}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground"
              >
                {m} мин
              </button>
            ))}
          </div>
          {savedFlash && (
            <p className="mt-3 text-center text-sm font-medium text-accent">
              Записано ✓
            </p>
          )}
        </>
      )}
    </div>
  );
}
