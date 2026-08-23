"use client";

import { useMemo, useState } from "react";
import {
  classifyCycleDay,
  collectPeriodStarts,
  DEFAULT_CYCLE,
  estimateCycleLength,
  monthMatrix,
  nextPeriodDate,
  ovulationDate,
  type CycleSettings,
} from "@/lib/cycle";
import { localToday } from "@/lib/local-date";
import { useAppStore } from "@/lib/store";

const WEEK = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function CycleTracker() {
  const entries = useAppStore((s) => s.journals.cycle ?? []);
  const pregnancy = useAppStore((s) => s.pregnancy);
  const setPregnancy = useAppStore((s) => s.setPregnancy);
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [len, setLen] = useState(
    pregnancy.cycleLength || DEFAULT_CYCLE.cycleLength,
  );
  const [periodLen, setPeriodLen] = useState(
    pregnancy.periodLength || DEFAULT_CYCLE.periodLength,
  );

  const starts = useMemo(
    () =>
      collectPeriodStarts(
        entries.map((e) => ({
          date: e.date,
          value: e.value,
          fields: e.fields,
        })),
      ),
    [entries],
  );
  const lastStart = starts[starts.length - 1] ?? null;
  const estimated = estimateCycleLength(starts, len);
  const settings: CycleSettings = {
    cycleLength: estimated || len,
    periodLength: periodLen,
  };

  const rows = useMemo(
    () => monthMatrix(cursor.y, cursor.m),
    [cursor.y, cursor.m],
  );

  const nextP = nextPeriodDate(lastStart, settings.cycleLength);
  const ovu = ovulationDate(lastStart, settings.cycleLength);
  const today = localToday();

  const [selected, setSelected] = useState<string | null>(null);

  function persistSettings(nextLen: number, nextPeriod: number) {
    setLen(nextLen);
    setPeriodLen(nextPeriod);
    setPregnancy({
      cycleLength: nextLen,
      periodLength: nextPeriod,
      trackCycle: true,
    });
  }

  function markPeriodStart(date: string) {
    if (starts.includes(date)) {
      setSelected(null);
      return;
    }
    addJournalEntry("cycle", {
      date,
      value: "1-й день цикла",
      note: "",
      fields: { kind: "period_start" },
    });
    setSelected(null);
  }

  function markNote(date: string) {
    addJournalEntry("cycle", {
      date,
      value: "Самочувствие",
      note: "",
      fields: { kind: "note" },
    });
    setSelected(null);
  }

  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-card/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-lg border border-line px-2 py-1 text-sm"
            onClick={() =>
              setCursor((c) => {
                const d = new Date(c.y, c.m - 1, 1);
                return { y: d.getFullYear(), m: d.getMonth() };
              })
            }
          >
            ←
          </button>
          <p className="font-display text-lg font-semibold capitalize">{title}</p>
          <button
            type="button"
            className="rounded-lg border border-line px-2 py-1 text-sm"
            onClick={() =>
              setCursor((c) => {
                const d = new Date(c.y, c.m + 1, 1);
                return { y: d.getFullYear(), m: d.getMonth() };
              })
            }
          >
            →
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-muted">
          {WEEK.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {rows.flat().map((iso, i) => {
            if (!iso) return <div key={`e-${i}`} />;
            const kind = classifyCycleDay(iso, starts, settings);
            const isToday = iso === today;
            const bg =
              kind === "period"
                ? "bg-blush/80 text-white"
                : kind === "predicted_period"
                  ? "bg-blush/40 text-foreground"
                  : kind === "ovulation"
                    ? "bg-accent text-white"
                    : kind === "fertile"
                      ? "bg-accent-soft text-accent"
                      : "bg-background/60";
            return (
              <button
                key={iso}
                type="button"
                title={iso}
                onClick={() => setSelected(iso)}
                className={`aspect-square rounded-lg text-xs font-medium ${bg} ${
                  isToday ? "ring-2 ring-accent" : ""
                } ${selected === iso ? "ring-2 ring-foreground" : ""}`}
              >
                {Number(iso.slice(8, 10))}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
          <span>
            <i className="mr-1 inline-block h-2 w-2 rounded-full bg-blush/80" />
            месячные
          </span>
          <span>
            <i className="mr-1 inline-block h-2 w-2 rounded-full bg-blush/40" />
            прогноз
          </span>
          <span>
            <i className="mr-1 inline-block h-2 w-2 rounded-full bg-accent-soft" />
            фертильное
          </span>
          <span>
            <i className="mr-1 inline-block h-2 w-2 rounded-full bg-accent" />
            овуляция
          </span>
        </div>

        {selected && (
          <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-line bg-background/50 p-2">
            <p className="w-full text-xs text-muted">Дата {selected}</p>
            <button
              type="button"
              onClick={() => markPeriodStart(selected)}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white"
            >
              1-й день цикла
            </button>
            <button
              type="button"
              onClick={() => markNote(selected)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs"
            >
              Самочувствие
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg px-2 text-xs text-muted"
            >
              Отмена
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-card/60 p-4 text-sm">
        <p>
          Последний 1-й день:{" "}
          <strong>{lastStart ?? "ещё не отмечен"}</strong>
        </p>
        <p className="mt-1 text-muted">
          Следующие месячные ≈ {nextP ?? "—"} · овуляция ≈ {ovu ?? "—"}
        </p>
        <p className="mt-1 text-xs text-muted">
          Длина цикла ≈ {settings.cycleLength} дн. (по вашим записям / настройке).
          Ориентир, не медицинский прогноз.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs">
            Цикл (дн.)
            <input
              type="number"
              min={21}
              max={45}
              value={len}
              onChange={(e) => {
                const v = Number(e.target.value) || 28;
                persistSettings(v, periodLen);
              }}
              className="mt-1 w-full rounded-xl border border-line px-2 py-2"
            />
          </label>
          <label className="text-xs">
            Менструация (дн.)
            <input
              type="number"
              min={2}
              max={10}
              value={periodLen}
              onChange={(e) => {
                const v = Number(e.target.value) || 5;
                persistSettings(len, v);
              }}
              className="mt-1 w-full rounded-xl border border-line px-2 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => markPeriodStart(today)}
          className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white"
        >
          Сегодня — 1-й день цикла
        </button>
      </div>
    </div>
  );
}
