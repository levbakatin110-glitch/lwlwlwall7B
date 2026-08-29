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
  /** Интервал от начала этой схватки до начала предыдущей (старше) */
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
    // предыдущая по времени = самая свежая в timeline (первая в списке)
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

  const hasData = timeline.length > 0 || live;

  return (
    <div className="relative pb-24">
      {/* Статистика */}
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

      {/* Таймлайн */}
      {hasData ? (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between px-1 text-[11px] font-medium text-muted">
            <span>Продолжительность</span>
            <span>Интервал</span>
          </div>

          <ul className="relative">
            {/* вертикальная линия */}
            <div
              className="pointer-events-none absolute left-1/2 top-3 bottom-3 w-px -translate-x-1/2 bg-accent/25"
              aria-hidden
            />

            {live ? (
              <li className="relative grid grid-cols-[1fr_2.5rem_1fr] items-center gap-2 py-3">
                <div className="flex items-baseline justify-end gap-2 pr-1">
                  <span className="text-[11px] tabular-nums text-muted">
                    {formatClock(live.startMs)}
                  </span>
                  <span className="font-display text-xl font-semibold tabular-nums text-accent">
                    {formatSec(liveDurationSec)}
                  </span>
                </div>
                <div className="relative z-[1] flex justify-center">
                  <span className="flex h-9 w-9 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-accent to-[color-mix(in_oklab,var(--accent)_70%,#f97316)] text-sm font-bold text-[var(--on-accent,#fff)] shadow-md ring-4 ring-accent/20">
                    {timeline.length + 1}
                  </span>
                </div>
                <div className="pl-1 text-sm tabular-nums text-muted">
                  {timeline[0]
                    ? formatSec(
                        Math.max(
                          0,
                          Math.floor((live.startMs - timeline[0].startMs) / 1000),
                        ),
                      )
                    : "—"}
                </div>
              </li>
            ) : null}

            {timeline.map((item, i) => {
              const isNewest = i === 0 && !live;
              return (
                <li
                  key={item.id}
                  className="relative grid grid-cols-[1fr_2.5rem_1fr] items-center gap-2 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm("Удалить эту схватку из дневника?")
                      ) {
                        removeJournalEntry("contractions", item.id);
                      }
                    }}
                    className="flex items-baseline justify-end gap-2 pr-1 text-right"
                    title="Удалить"
                  >
                    <span className="text-[11px] tabular-nums text-muted">
                      {formatClock(item.startMs)}
                    </span>
                    <span
                      className={`font-display text-xl font-semibold tabular-nums ${
                        isNewest ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {formatSec(item.durationSec)}
                    </span>
                  </button>

                  <div className="relative z-[1] flex justify-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[color-mix(in_oklab,var(--accent)_65%,#fb7185)] text-sm font-bold text-[var(--on-accent,#fff)] shadow-sm">
                      {item.number}
                    </span>
                  </div>

                  <div className="pl-1">
                    {item.intervalSec != null ? (
                      <span className="text-sm tabular-nums text-muted">
                        {formatSec(item.intervalSec)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted/40">—</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-8 text-center text-sm text-muted">
          Нажмите кнопку, когда начнётся схватка
        </p>
      )}

      {/* Кнопка */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2">
          {live ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={stopAndSave}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-[color-mix(in_oklab,var(--accent)_70%,#f97316)] px-5 py-4 text-base font-semibold text-[var(--on-accent,#fff)] shadow-[0_8px_28px_color-mix(in_oklab,var(--accent)_45%,transparent)]"
              >
                <span className="tabular-nums">{formatSec(liveDurationSec)}</span>
                <span>· закончилась</span>
              </button>
              <button
                type="button"
                onClick={cancel}
                className="shrink-0 rounded-2xl border border-line bg-card px-4 py-4 text-sm font-medium text-muted"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={start}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-accent via-[color-mix(in_oklab,var(--accent)_85%,#fb7185)] to-[color-mix(in_oklab,var(--accent)_75%,#f97316)] px-5 py-4 text-base font-semibold text-[var(--on-accent,#fff)] shadow-[0_8px_28px_color-mix(in_oklab,var(--accent)_45%,transparent)] transition active:scale-[0.98]"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M13 2 4.8 12.6c-.4.5-.1 1.2.5 1.4H11l-1 8 8.2-10.6c.4-.5.1-1.2-.5-1.4H13l1-8Z" />
              </svg>
              Схватка началась
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
