"use client";

import { useEffect, useMemo, useState } from "react";
import { localToday } from "@/lib/local-date";
import { formatSec } from "@/lib/pregnancy";
import { getJournalEntries, useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

type LiveRow = { startMs: number };

const SESSION_KEY = "maya-contractions-session";

type TimelineItem = {
  id: string;
  startMs: number;
  endMs: number;
  durationSec: number;
  intervalSec: number | null;
  number: number;
};

function entryStartMs(e: JournalEntry): number {
  const f = e.fields;
  if (typeof f?.startMs === "number") return f.startMs;
  if (typeof f?.endMs === "number" && typeof f?.durationSec === "number") {
    return f.endMs - f.durationSec * 1000;
  }
  if (e.createdAt) {
    const t = Date.parse(e.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(`${e.date}T12:00:00`);
}

function entryEndMs(e: JournalEntry): number {
  const f = e.fields;
  if (typeof f?.endMs === "number") return f.endMs;
  if (typeof f?.durationSec === "number") {
    return entryStartMs(e) + f.durationSec * 1000;
  }
  return entryStartMs(e);
}

function entryDurationSec(e: JournalEntry): number {
  const f = e.fields;
  if (typeof f?.durationSec === "number") return f.durationSec;
  return Math.max(1, Math.floor((entryEndMs(e) - entryStartMs(e)) / 1000));
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildTimeline(entries: JournalEntry[]): TimelineItem[] {
  const today = localToday();
  const day = entries
    .filter((e) => e.date === today)
    .map((e) => ({
      id: e.id,
      startMs: entryStartMs(e),
      endMs: entryEndMs(e),
      durationSec: entryDurationSec(e),
    }))
    .sort((a, b) => a.startMs - b.startMs);

  return day
    .map((item, i) => {
      const prev = i > 0 ? day[i - 1] : null;
      const intervalSec = prev
        ? Math.max(0, Math.floor((item.startMs - prev.startMs) / 1000))
        : null;
      return {
        ...item,
        intervalSec,
        number: i + 1,
      };
    })
    .reverse();
}

export function ContractionsTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => getJournalEntries(s, "contractions"));
  const [live, setLive] = useState<LiveRow | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LiveRow;
        if (parsed?.startMs) setLive(parsed);
      }
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    try {
      if (!live) sessionStorage.removeItem(SESSION_KEY);
      else sessionStorage.setItem(SESSION_KEY, JSON.stringify(live));
    } catch {
      /* */
    }
  }, [live]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [live]);

  const timeline = useMemo(() => buildTimeline(entries), [entries]);

  const liveDurationSec = live
    ? Math.max(0, Math.floor((now - live.startMs) / 1000))
    : 0;

  const stats = useMemo(() => {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const inHour = timeline.filter((t) => t.startMs >= hourAgo).length;
    const durations = timeline.map((t) => t.durationSec);
    const intervals = timeline
      .map((t) => t.intervalSec)
      .filter((x): x is number => x != null && x > 0);
    const avgDur =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
    const avgInt =
      intervals.length > 0
        ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
        : 0;
    return { inHour, avgDur, avgInt };
  }, [timeline]);

  function start() {
    setLive({ startMs: Date.now() });
    setNow(Date.now());
  }

  function stopAndSave() {
    if (!live) return;
    const endMs = Date.now();
    const startMs = live.startMs;
    const dur = Math.max(1, Math.floor((endMs - startMs) / 1000));
    const prevStart = timeline[0]?.startMs ?? null;
    const interval =
      prevStart != null
        ? Math.max(0, Math.floor((startMs - prevStart) / 1000))
        : null;
    const value =
      interval != null
        ? `${formatSec(dur)} · интервал ${formatSec(interval)}`
        : formatSec(dur);
    addJournalEntry("contractions", {
      date: localToday(),
      value,
      note: "",
      fields: {
        durationSec: dur,
        ...(interval != null ? { intervalSec: interval } : {}),
        startMs,
        endMs,
      },
    });
    setLive(null);
  }

  function cancel() {
    setLive(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-card px-3 py-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] leading-tight text-muted">Кол-во в час</p>
            <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums tracking-tight">
              {stats.inHour}
            </p>
          </div>
          <div className="border-x border-line">
            <p className="text-[10px] leading-tight text-muted">Ср. длительность</p>
            <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums tracking-tight">
              {formatSec(stats.avgDur)}
            </p>
          </div>
          <div>
            <p className="text-[10px] leading-tight text-muted">Ср. интервал</p>
            <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums tracking-tight">
              {stats.avgInt > 0 ? formatSec(stats.avgInt) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Кнопка в потоке — не fixed (у .maya-page transform ломает fixed) */}
      <div className="rounded-2xl border border-line bg-card p-3 shadow-sm">
        {live ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted">
              Идёт схватка ·{" "}
              <span className="font-display text-lg font-semibold tabular-nums text-accent">
                {formatSec(liveDurationSec)}
              </span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={stopAndSave}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-base font-semibold text-[var(--on-accent,#fff)]"
              >
                <span className="tabular-nums">{formatSec(liveDurationSec)}</span>
                <span>· закончилась</span>
              </button>
              <button
                type="button"
                onClick={cancel}
                className="shrink-0 rounded-2xl border border-line bg-background px-4 py-3.5 text-sm font-medium text-muted"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={start}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-base font-semibold text-[var(--on-accent,#fff)] transition active:scale-[0.99]"
          >
            Схватка началась
          </button>
        )}
        <p className="mt-2 text-center text-[11px] text-muted">
          Это не замена врачу. При тревоге — в роддом / скорую.
        </p>
      </div>

      {timeline.length === 0 && !live ? (
        <p className="rounded-2xl border border-dashed border-line bg-card/50 px-4 py-8 text-center text-sm text-muted">
          Пока пусто
        </p>
      ) : (
        <ul className="space-y-2">
          {live ? (
            <li className="flex items-center gap-3 rounded-2xl border border-accent/35 bg-accent-soft/60 px-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-[var(--on-accent,#fff)]">
                {timeline.length + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] tabular-nums text-muted">
                  сейчас · с {formatClock(live.startMs)}
                </p>
                <p className="font-display text-lg font-semibold tabular-nums text-accent">
                  {formatSec(liveDurationSec)}
                </p>
              </div>
              <p className="shrink-0 text-right text-[11px] text-muted">
                идёт…
              </p>
            </li>
          ) : null}

          {timeline.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-3 shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[color-mix(in_oklab,var(--accent)_65%,#fb7185)] text-sm font-bold text-[var(--on-accent,#fff)]">
                {item.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] tabular-nums text-muted">
                  {formatClock(item.startMs)}
                  {item.intervalSec != null
                    ? ` · интервал ${formatSec(item.intervalSec)}`
                    : ""}
                </p>
                <p className="font-display text-lg font-semibold tabular-nums">
                  {formatSec(item.durationSec)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Удалить эту схватку из дневника?")) {
                    removeJournalEntry("contractions", item.id);
                  }
                }}
                className="shrink-0 rounded-xl px-2 py-1.5 text-xs text-muted hover:bg-background hover:text-foreground"
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
