"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DiaryEmpty,
  DiaryPage,
  DiaryPrimaryButton,
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
  formatDuration,
  todayYmd,
} from "@/lib/diary-day";
import { getJournalEntries, useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const SESSION_KEY = "maya-kicks-session";
const GOAL = 10;

type KickSession = {
  count: number;
  startMs: number;
};

function loadSession(): KickSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as KickSession;
    if (typeof s?.startMs === "number" && s.count > 0) return s;
  } catch {
    /* */
  }
  return null;
}

function entryCount(e: JournalEntry): number {
  const n = Number(e.fields?.count);
  if (Number.isFinite(n) && n > 0) return n;
  const m = e.value.match(/(\d+)\s*толч/i);
  return m ? Number(m[1]) : 0;
}

function entryDurationSec(e: JournalEntry): number {
  const n = Number(e.fields?.durationSec);
  if (Number.isFinite(n) && n >= 0) return n;
  return 0;
}

function entryEndMs(e: JournalEntry): number {
  const f = e.fields;
  if (typeof f?.endMs === "number") return f.endMs;
  const start = entryTimeMs(e);
  return start + entryDurationSec(e) * 1000;
}

export function KicksTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => getJournalEntries(s, "kicks"));
  const [count, setCount] = useState(0);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const s = loadSession();
    if (s) {
      setCount(s.count);
      setStartMs(s.startMs);
    }
  }, []);

  useEffect(() => {
    try {
      if (startMs == null || count <= 0) {
        sessionStorage.removeItem(SESSION_KEY);
      } else {
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ count, startMs } satisfies KickSession),
        );
      }
    } catch {
      /* */
    }
  }, [count, startMs]);

  useEffect(() => {
    if (startMs == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [startMs]);

  const todaySessions = useMemo(() => {
    return entriesForToday(entries)
      .map((e) => ({
        e,
        count: entryCount(e),
        durationSec: entryDurationSec(e),
        startMs: entryTimeMs(e),
        endMs: entryEndMs(e),
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.startMs - a.startMs);
  }, [entries]);

  const elapsed = startMs
    ? Math.max(0, Math.floor((now - startMs) / 1000))
    : 0;
  const toGoal = Math.max(0, GOAL - count);
  const goalReached = count >= GOAL;
  const active = count > 0 && startMs != null;

  function tap() {
    const t = Date.now();
    if (startMs == null) setStartMs(t);
    setCount((c) => c + 1);
    setNow(t);
  }

  function reset() {
    setCount(0);
    setStartMs(null);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function save() {
    if (count <= 0 || startMs == null) return;
    const endMs = Date.now();
    const durationSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
    addJournalEntry("kicks", {
      date: todayYmd(),
      value: `${count} толчков за ${formatDuration(durationSec)}`,
      note: "",
      fields: { count, durationSec, startMs, endMs },
    });
    reset();
  }

  return (
    <DiaryPage stickyPad={active}>
      <DiaryStats
        items={[
          { label: "Толчков", value: count },
          {
            label: "Время сессии",
            value: startMs ? formatDuration(elapsed) : "—",
          },
          {
            label: "До 10",
            value: active ? (toGoal > 0 ? toGoal : "✓") : GOAL,
          },
        ]}
      />

      {active ? (
        <div className="h-2 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${Math.min(100, (count / GOAL) * 100)}%` }}
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={tap}
        className="mt-5 flex w-full flex-col items-center justify-center rounded-3xl border border-line bg-gradient-to-b from-card to-[color-mix(in_oklab,var(--accent)_6%,var(--card))] py-14 shadow-sm transition active:scale-[0.98]"
      >
        <span className="font-display text-6xl font-semibold tabular-nums tracking-tight text-accent">
          {count}
        </span>
        <span className="mt-2 text-sm font-medium text-muted">
          {active ? "Нажмите при толчке" : "Первый толчок"}
        </span>
      </button>

      {todaySessions.length > 0 ? (
        <div className="mt-6">
          <DiarySectionTitle
            left="Сегодня"
            right={`${todaySessions.length}`}
          />
          <DiaryTimeline>
            {todaySessions.map((item, i) => (
              <li key={item.e.id}>
                <DiaryTimelineRow
                  accent={i === 0 && !active}
                  left={
                    <span className="text-[11px] tabular-nums text-muted">
                      {formatClock(item.startMs)}
                    </span>
                  }
                  mark={item.count}
                  right={
                    <span className="text-sm tabular-nums text-muted">
                      {formatDuration(item.durationSec)}
                    </span>
                  }
                  onClick={() => {
                    if (window.confirm("Удалить сессию?")) {
                      removeJournalEntry("kicks", item.e.id);
                    }
                  }}
                />
              </li>
            ))}
          </DiaryTimeline>
        </div>
      ) : !active ? (
        <DiaryEmpty>Первый толчок начинает сессию.</DiaryEmpty>
      ) : null}

      {active ? (
        <DiaryStickyCta>
          {goalReached ? (
            <DiaryPrimaryButton onClick={save}>
              Цель {GOAL} — сохранить сессию
            </DiaryPrimaryButton>
          ) : (
            <div className="flex gap-2">
              <DiaryPrimaryButton onClick={save}>
                Сохранить сессию
              </DiaryPrimaryButton>
              <button
                type="button"
                onClick={reset}
                className="shrink-0 rounded-2xl border border-line bg-card px-4 py-4 text-sm font-medium text-muted"
              >
                ×
              </button>
            </div>
          )}
        </DiaryStickyCta>
      ) : null}
    </DiaryPage>
  );
}
