"use client";

import { useMemo, useState } from "react";
import { SleepTracker } from "@/components/feeding/SleepTracker";
import { toLocalDateIso } from "@/lib/local-date";
import { getJournalEntries, useAppStore } from "@/lib/store";

function fmtSec(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

function stripRuDate(s: string): string {
  return s.replace(/\./g, "").replace(/\u00a0/g, " ").trim();
}

function weekRangeLabel(start: Date, end: Date): string {
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    const month = stripRuDate(
      end.toLocaleDateString("ru-RU", { month: "short" }),
    );
    return `${start.getDate()}–${end.getDate()} ${month}`;
  }
  const a = stripRuDate(
    start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
  );
  const b = stripRuDate(
    end.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
  );
  return `${a} — ${b}`;
}

export function MomSleepCalendar() {
  const entries = useAppStore((s) => getJournalEntries(s, "preg_sleep"));
  const [offset, setOffset] = useState(0); // weeks back

  const days = useMemo(() => {
    const out: {
      iso: string;
      weekday: string;
      date: string;
      totalSec: number;
    }[] = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    base.setDate(base.getDate() - offset * 7);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const iso = toLocalDateIso(d);
      const dayEntries = entries.filter((e) => e.date === iso);
      const totalSec = dayEntries.reduce((s, e) => {
        const n = Number(e.fields?.totalSec);
        return s + (Number.isFinite(n) ? n : 0);
      }, 0);
      out.push({
        iso,
        weekday: stripRuDate(
          d.toLocaleDateString("ru-RU", { weekday: "short" }),
        ),
        date: stripRuDate(
          d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
        ),
        totalSec,
      });
    }
    return out;
  }, [entries, offset]);

  const max = Math.max(1, ...days.map((d) => d.totalSec));
  const rangeLabel =
    days.length >= 2
      ? weekRangeLabel(
          new Date(`${days[0].iso}T12:00:00`),
          new Date(`${days[days.length - 1].iso}T12:00:00`),
        )
      : "";

  return (
    <div className="space-y-4">
      <SleepTracker journalId="preg_sleep" />
      <div className="rounded-2xl border border-line bg-card/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Неделя сна
            </p>
            {rangeLabel ? (
              <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                {rangeLabel}
              </p>
            ) : null}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded-lg border border-line px-2 py-0.5 text-xs"
              onClick={() => setOffset((o) => o + 1)}
            >
              ←
            </button>
            <button
              type="button"
              className="rounded-lg border border-line px-2 py-0.5 text-xs"
              disabled={offset <= 0}
              onClick={() => setOffset((o) => Math.max(0, o - 1))}
            >
              →
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-1">
          {days.map((d) => (
            <div key={d.iso} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-accent/80"
                style={{
                  height: `${Math.max(4, (d.totalSec / max) * 64)}px`,
                }}
                title={fmtSec(d.totalSec)}
              />
              <span className="text-center text-[11px] leading-tight text-muted">
                {d.weekday}
              </span>
              <span className="text-center text-[11px] font-medium leading-tight tabular-nums text-foreground">
                {d.date}
              </span>
              <span className="text-center text-[11px] tabular-nums text-foreground/80">
                {d.totalSec > 0 ? fmtSec(d.totalSec) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
