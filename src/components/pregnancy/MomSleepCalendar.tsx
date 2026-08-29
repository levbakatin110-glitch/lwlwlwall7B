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

export function MomSleepCalendar() {
  const entries = useAppStore((s) => getJournalEntries(s, "preg_sleep"));
  const [offset, setOffset] = useState(0); // weeks back

  const days = useMemo(() => {
    const out: { iso: string; label: string; totalSec: number }[] = [];
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
        label: d.toLocaleDateString("ru-RU", {
          weekday: "short",
          day: "numeric",
        }),
        totalSec,
      });
    }
    return out;
  }, [entries, offset]);

  const max = Math.max(1, ...days.map((d) => d.totalSec));

  return (
    <div className="space-y-4">
      <SleepTracker journalId="preg_sleep" />
      <div className="rounded-2xl border border-line bg-card/60 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Неделя сна
          </p>
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
        <div className="mt-4 flex items-end justify-between gap-1.5">
          {days.map((d) => (
            <div key={d.iso} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-accent/80"
                style={{
                  height: `${Math.max(4, (d.totalSec / max) * 64)}px`,
                }}
                title={fmtSec(d.totalSec)}
              />
              <span className="text-[9px] text-muted">{d.label}</span>
              <span className="text-[9px] tabular-nums text-foreground/80">
                {d.totalSec > 0 ? fmtSec(d.totalSec) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
