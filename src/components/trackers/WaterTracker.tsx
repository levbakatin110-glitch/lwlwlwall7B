"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DiaryChip,
  DiaryCoach,
  DiaryEmpty,
  DiaryPage,
  DiarySectionTitle,
  DiaryStats,
  DiaryStickyCta,
  DiaryTimeline,
  DiaryTimelineRow,
} from "@/components/diary/DiaryShell";
import {
  entriesForToday,
  entryTimeMs,
  formatClock,
  todayYmd,
} from "@/lib/diary-day";
import { useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const GOAL_KEY = "maya-water-goal";
const GOAL_OPTIONS = [1500, 2000, 2500] as const;
const DEFAULT_GOAL = 2000;
const QUICK_ML = [100, 200, 250, 500] as const;

function loadGoal(): number {
  try {
    const n = Number(localStorage.getItem(GOAL_KEY));
    if ((GOAL_OPTIONS as readonly number[]).includes(n)) return n;
  } catch {
    /* */
  }
  return DEFAULT_GOAL;
}

function entryMl(e: JournalEntry): number {
  const fromField = Number(e.fields?.ml);
  if (Number.isFinite(fromField)) return fromField;
  const m = e.value.match(/(\d+)\s*мл/i);
  return m ? Number(m[1]) : 0;
}

export function WaterTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => s.journals.water ?? []);
  const [goal, setGoal] = useState(DEFAULT_GOAL);

  useEffect(() => {
    setGoal(loadGoal());
  }, []);

  function setGoalAndStore(ml: number) {
    setGoal(ml);
    try {
      localStorage.setItem(GOAL_KEY, String(ml));
    } catch {
      /* */
    }
  }

  const todayEntries = useMemo(
    () =>
      entriesForToday(entries)
        .map((e) => ({ e, ml: entryMl(e), startMs: entryTimeMs(e) }))
        .filter((x) => x.ml > 0)
        .sort((a, b) => b.startMs - a.startMs),
    [entries],
  );

  const todayMl = useMemo(
    () => todayEntries.reduce((sum, x) => sum + x.ml, 0),
    [todayEntries],
  );

  const pct = goal > 0 ? Math.min(100, Math.round((todayMl / goal) * 100)) : 0;
  const left = Math.max(0, goal - todayMl);
  const ringPct = Math.min(1, todayMl / goal);
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference * (1 - ringPct);

  function addWater(amount: number) {
    if (amount < 20) return;
    const startMs = Date.now();
    addJournalEntry("water", {
      date: todayYmd(),
      value: `${amount} мл`,
      note: "",
      fields: { ml: amount, startMs },
    });
  }

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          { label: "Выпито", value: `${todayMl} мл` },
          { label: "% цели", value: `${pct}%` },
          { label: "Осталось", value: left > 0 ? `${left} мл` : "✓" },
        ]}
      />

      <DiaryCoach
        tone={pct >= 100 ? "ok" : pct < 30 && todayEntries.length > 0 ? "watch" : "tip"}
        title={
          pct >= 100
            ? "Норма на сегодня"
            : left > 0
              ? `Ещё ${left} мл`
              : "Глоток"
        }
      >
        {pct >= 100
          ? "Цель закрыта. Дальше — по жажде, без гонки за литрами."
          : "Грудное вскармливание и жара требуют больше. Стакан у кровати срабатывает лучше напоминалок."}
      </DiaryCoach>

      <div className="mt-5 flex flex-col items-center">
        <div className="relative h-36 w-36">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="color-mix(in oklab, var(--line) 80%, transparent)"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">
              {todayMl}
            </p>
            <p className="text-[11px] text-muted">из {goal} мл</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {GOAL_OPTIONS.map((g) => (
            <DiaryChip
              key={g}
              active={goal === g}
              onClick={() => setGoalAndStore(g)}
            >
              {g}
            </DiaryChip>
          ))}
        </div>
      </div>

      {todayEntries.length > 0 ? (
        <div className="mt-6">
          <DiarySectionTitle left="Сегодня" right={`${todayEntries.length}`} />
          <DiaryTimeline>
            {todayEntries.map((item) => (
              <li key={item.e.id}>
                <DiaryTimelineRow
                  left={
                    <span className="text-[11px] tabular-nums text-muted">
                      {formatClock(item.startMs)}
                    </span>
                  }
                  mark={item.ml}
                  right={
                    <span className="text-sm tabular-nums text-muted">
                      {item.ml} мл
                    </span>
                  }
                  onClick={() => {
                    if (window.confirm("Удалить запись?")) {
                      removeJournalEntry("water", item.e.id);
                    }
                  }}
                />
              </li>
            ))}
          </DiaryTimeline>
        </div>
      ) : (
        <DiaryEmpty>Пока пусто</DiaryEmpty>
      )}

      <DiaryStickyCta>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_ML.map((ml) => (
            <button
              key={ml}
              type="button"
              onClick={() => addWater(ml)}
              className="rounded-2xl border border-line bg-card py-3.5 text-sm font-semibold tabular-nums text-foreground shadow-sm transition active:scale-[0.97]"
            >
              +{ml}
            </button>
          ))}
        </div>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
