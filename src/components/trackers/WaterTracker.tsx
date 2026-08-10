"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";

const PRESETS = [100, 150, 200, 250, 300, 500] as const;
const GOAL_ML = 2000;

export function WaterTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const entries = useAppStore((s) => s.journals.water ?? []);
  const [ml, setMl] = useState(250);
  const [savedFlash, setSavedFlash] = useState(false);

  const todayMl = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return entries
      .filter((e) => e.date === today)
      .reduce((sum, e) => {
        const fromField = Number(e.fields?.ml);
        if (Number.isFinite(fromField)) return sum + fromField;
        const m = e.value.match(/(\d+)\s*мл/i);
        return sum + (m ? Number(m[1]) : 0);
      }, 0);
  }, [entries]);

  const progress = Math.min(1, todayMl / GOAL_ML);
  const fillY = 18 + (1 - progress) * 72;

  function save(amount = ml) {
    if (amount < 20) return;
    addJournalEntry("water", {
      date: new Date().toISOString().slice(0, 10),
      value: `${amount} мл`,
      note: "",
      fields: { ml: amount },
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  }

  return (
    <div className="maya-rise overflow-hidden rounded-[1.5rem] border border-line bg-card/80 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Вода за день
          </h2>
          <p className="mt-1 text-xs text-muted">
            Цель ~{GOAL_ML} мл · осталось{" "}
            {Math.max(0, GOAL_ML - todayMl)} мл
          </p>
        </div>
        <p className="font-display text-3xl font-semibold tabular-nums">
          {todayMl}
          <span className="ml-1 text-base font-medium text-muted">мл</span>
        </p>
      </div>

      <div className="mt-5 flex items-end justify-center gap-8">
        <svg viewBox="0 0 72 110" className="h-36 w-24" aria-hidden>
          <path
            d="M18 14h36l6 78c0 6-5 10-12 10H24c-7 0-12-4-12-10l6-78Z"
            className="fill-background stroke-line"
            strokeWidth="1.5"
          />
          <defs>
            <clipPath id="water-glass">
              <path d="M20 16h32l5.5 76c0 4-4 8-10 8H24.5c-6 0-10-4-10-8L20 16Z" />
            </clipPath>
          </defs>
          <g clipPath="url(#water-glass)">
            <rect
              x="14"
              y={fillY}
              width="44"
              height={110 - fillY}
              className="fill-sky-400/55 dark:fill-sky-300/40"
            />
            <ellipse
              cx="36"
              cy={fillY}
              rx="18"
              ry="3"
              className="fill-sky-300/90 dark:fill-sky-200/50"
            />
          </g>
          <path
            d="M22 12h28"
            className="stroke-foreground/25"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        <div className="min-w-[7rem]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Добавить
          </p>
          <p className="font-display mt-1 text-4xl font-semibold tabular-nums">
            {ml}
            <span className="ml-1 text-base text-muted">мл</span>
          </p>
          <input
            type="range"
            min={50}
            max={500}
            step={10}
            value={ml}
            onChange={(e) => setMl(Number(e.target.value))}
            className="mt-3 w-full accent-[var(--accent)]"
          />
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-line/50">
        <div
          className="h-full rounded-full bg-sky-400 transition-all dark:bg-sky-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p className="mt-1.5 text-center text-[11px] text-muted">
        {Math.round(progress * 100)}%
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setMl(p);
              save(p);
            }}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:border-accent/40 hover:text-foreground"
          >
            +{p}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => save()}
        className="mt-4 w-full rounded-2xl bg-accent py-3 text-sm font-semibold text-on-accent"
      >
        {savedFlash ? "Записано ✓" : `Выпить ${ml} мл`}
      </button>
    </div>
  );
}
