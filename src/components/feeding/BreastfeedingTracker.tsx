"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DiaryChip,
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
} from "@/lib/diary-day";
import { liveGet, liveSet } from "@/lib/live-session";
import { useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

type Side = "left" | "right";

type LiveSession = {
  leftSec: number;
  rightSec: number;
  active: Side | null;
  tickAt: number | null;
};

const STORAGE_KEY = "maya-bf-session";

function loadSession(): LiveSession {
  if (typeof window === "undefined") {
    return { leftSec: 0, rightSec: 0, active: null, tickAt: null };
  }
  try {
    const raw = liveGet(STORAGE_KEY);
    if (!raw) return { leftSec: 0, rightSec: 0, active: null, tickAt: null };
    return JSON.parse(raw) as LiveSession;
  } catch {
    return { leftSec: 0, rightSec: 0, active: null, tickAt: null };
  }
}

function saveSession(s: LiveSession) {
  try {
    liveSet(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function clearSession() {
  liveSet(STORAGE_KEY, null);
}

function settle(s: LiveSession, now = Date.now()): LiveSession {
  if (!s.active || !s.tickAt) return s;
  const add = Math.max(0, Math.floor((now - s.tickAt) / 1000));
  if (add <= 0) return s;
  return {
    ...s,
    leftSec: s.active === "left" ? s.leftSec + add : s.leftSec,
    rightSec: s.active === "right" ? s.rightSec + add : s.rightSec,
    tickAt: now,
  };
}

function bfStartMs(e: JournalEntry): number {
  if (typeof e.fields?.startMs === "number") return e.fields.startMs;
  return entryTimeMs(e);
}

function bfEndMs(e: JournalEntry): number {
  if (typeof e.fields?.endMs === "number") return e.fields.endMs;
  const sec = Number(e.fields?.totalSec);
  if (Number.isFinite(sec)) return bfStartMs(e) + sec * 1000;
  return bfStartMs(e);
}

function sideBreakdown(e: JournalEntry): string {
  const L = Number(e.fields?.leftSec);
  const R = Number(e.fields?.rightSec);
  const parts: string[] = [];
  if (Number.isFinite(L) && L > 0) parts.push(`Л ${formatDuration(L)}`);
  if (Number.isFinite(R) && R > 0) parts.push(`П ${formatDuration(R)}`);
  if (parts.length) return parts.join(" · ");
  const side = e.fields?.side;
  if (side === "left") return "Л";
  if (side === "right") return "П";
  return "—";
}

function lastSideFromEntries(entries: JournalEntry[]): Side | null {
  for (const e of entries) {
    const f = e.fields?.side;
    if (f === "left" || f === "right") return f;
    const L = Number(e.fields?.leftSec);
    const R = Number(e.fields?.rightSec);
    if (Number.isFinite(L) && Number.isFinite(R)) {
      if (L > R) return "left";
      if (R > L) return "right";
    }
    const v = `${e.value} ${e.note}`.toLowerCase();
    if (v.includes("лев")) return "left";
    if (v.includes("прав")) return "right";
  }
  return null;
}

export function BreastfeedingTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => s.journals.breastfeeding ?? []);

  const [session, setSession] = useState<LiveSession>({
    leftSec: 0,
    rightSec: 0,
    active: null,
    tickAt: null,
  });
  const [now, setNow] = useState(() => Date.now());
  const hydrated = useRef(false);

  useEffect(() => {
    setSession(loadSession());
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    saveSession(session);
  }, [session]);

  useEffect(() => {
    if (!session.active) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [session.active]);

  const live = useMemo(() => {
    if (!session.active || !session.tickAt) return session;
    const add = Math.max(0, Math.floor((now - session.tickAt) / 1000));
    return {
      ...session,
      leftSec: session.active === "left" ? session.leftSec + add : session.leftSec,
      rightSec:
        session.active === "right" ? session.rightSec + add : session.rightSec,
    };
  }, [session, now]);

  const total = live.leftSec + live.rightSec;

  const todayEntries = useMemo(() => {
    return entriesForToday(entries)
      .slice()
      .sort((a, b) => bfEndMs(b) - bfEndMs(a));
  }, [entries]);

  const lastSide = useMemo(() => lastSideFromEntries(entries), [entries]);
  const suggest: Side | null =
    lastSide === "left" ? "right" : lastSide === "right" ? "left" : null;

  const stats = useMemo(() => {
    const totalSec = todayEntries.reduce((s, e) => {
      const n = Number(e.fields?.totalSec);
      return s + (Number.isFinite(n) ? n : 0);
    }, 0);
    const lastLabel =
      lastSide === "left" ? "Л" : lastSide === "right" ? "П" : "—";
    return {
      count: todayEntries.length,
      minutes: totalSec > 0 ? formatDuration(totalSec) : "—",
      lastLabel,
    };
  }, [todayEntries, lastSide]);

  function start(side: Side) {
    setSession((prev) => {
      const settled = settle(prev);
      return { ...settled, active: side, tickAt: Date.now() };
    });
  }

  function pause() {
    setSession((prev) => {
      const settled = settle(prev);
      return { ...settled, active: null, tickAt: null };
    });
  }

  function reset() {
    clearSession();
    setSession({ leftSec: 0, rightSec: 0, active: null, tickAt: null });
  }

  function save() {
    const settled = settle(session);
    const L =
      settled.active === "left" && settled.tickAt
        ? settled.leftSec +
          Math.floor((Date.now() - settled.tickAt) / 1000)
        : settled.leftSec;
    const R =
      settled.active === "right" && settled.tickAt
        ? settled.rightSec +
          Math.floor((Date.now() - settled.tickAt) / 1000)
        : settled.rightSec;
    const sum = L + R;
    if (sum < 5) return;

    const endMs = Date.now();
    const startMs = endMs - sum * 1000;
    const parts: string[] = [];
    if (L > 0) parts.push(`левая ${formatDuration(L)}`);
    if (R > 0) parts.push(`правая ${formatDuration(R)}`);
    parts.push(`всего ${formatDuration(sum)}`);

    addJournalEntry("breastfeeding", {
      date: new Date().toISOString().slice(0, 10),
      value: parts.join(" · "),
      note: "",
      fields: {
        side: L >= R ? "left" : "right",
        leftSec: L,
        rightSec: R,
        totalSec: sum,
        startMs,
        endMs,
      },
    });
    reset();
  }

  return (
    <DiaryPage stickyPad={total >= 5}>
      <div className="flex items-center justify-end gap-2">
        {suggest && !live.active && total === 0 ? (
          <DiaryChip
            active
            tone="default"
            onClick={() => start(suggest)}
          >
            {suggest === "left" ? "С левой" : "С правой"}
          </DiaryChip>
        ) : null}
      </div>

      <DiaryStats
        items={[
          { label: "Кормлений", value: stats.count },
          { label: "Минут", value: stats.minutes },
          { label: "Последняя", value: stats.lastLabel },
        ]}
      />

      <div className="mt-5 grid grid-cols-2 gap-3">
        {(["left", "right"] as const).map((side) => {
          const active = live.active === side;
          const sec = side === "left" ? live.leftSec : live.rightSec;
          const label = side === "left" ? "Левая" : "Правая";
          const suggested = suggest === side && !live.active && total === 0;
          return (
            <button
              key={side}
              type="button"
              onClick={() => (active ? pause() : start(side))}
              className={`relative overflow-hidden rounded-[1.35rem] border px-3 py-5 text-left transition active:scale-[0.98] ${
                active
                  ? "border-accent/50 bg-accent/10 ring-2 ring-accent/20"
                  : suggested
                    ? "border-accent/35 bg-accent/5"
                    : "border-line bg-card hover:border-accent/30"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {label}
              </p>
              <p className="font-mono mt-2 text-3xl font-semibold tabular-nums tracking-tight">
                {formatDuration(sec)}
              </p>
              <p className="mt-2 text-sm font-semibold text-accent">
                {active ? "Пауза" : "Старт"}
              </p>
              {active ? (
                <span className="absolute right-3 top-3 h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
              ) : null}
            </button>
          );
        })}
      </div>

      {todayEntries.length > 0 ? (
        <div className="mt-5">
          <DiarySectionTitle left="Время" right="Стороны" />
          <DiaryTimeline>
            {todayEntries.map((e, i) => {
              const startMs = bfStartMs(e);
              const endMs = bfEndMs(e);
              const isNewest = i === 0;
              return (
                <li key={e.id}>
                  <DiaryTimelineRow
                    accent={isNewest}
                    mark={todayEntries.length - i}
                    onClick={() => {
                      if (
                        window.confirm("Удалить это кормление из дневника?")
                      ) {
                        removeJournalEntry("breastfeeding", e.id);
                      }
                    }}
                    left={
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[11px] tabular-nums text-muted">
                          {formatClock(startMs)}–{formatClock(endMs)}
                        </span>
                        <span
                          className={`font-display text-lg font-semibold tabular-nums ${
                            isNewest ? "text-accent" : "text-foreground"
                          }`}
                        >
                          {formatDuration(Number(e.fields?.totalSec) || 0)}
                        </span>
                      </div>
                    }
                    right={
                      <span className="text-sm font-medium tabular-nums">
                        {sideBreakdown(e)}
                      </span>
                    }
                  />
                </li>
              );
            })}
          </DiaryTimeline>
        </div>
      ) : null}

      <DiaryStickyCta>
        {total >= 5 ? (
          <div className="flex gap-2">
            <DiaryPrimaryButton onClick={save}>
              <span className="tabular-nums">{formatDuration(total)}</span>
              <span>· сохранить</span>
            </DiaryPrimaryButton>
            {(total > 0 || live.active) && (
              <button
                type="button"
                onClick={reset}
                className="shrink-0 rounded-2xl border border-line bg-card px-4 py-4 text-sm font-medium text-muted"
              >
                ×
              </button>
            )}
          </div>
        ) : null}
      </DiaryStickyCta>
    </DiaryPage>
  );
}
