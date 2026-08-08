"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";

type Side = "left" | "right";

type LiveSession = {
  leftSec: number;
  rightSec: number;
  active: Side | null;
  /** unix ms when active side started */
  tickAt: number | null;
};

const STORAGE_KEY = "maya-bf-session";

function loadSession(): LiveSession {
  if (typeof window === "undefined") {
    return { leftSec: 0, rightSec: 0, active: null, tickAt: null };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { leftSec: 0, rightSec: 0, active: null, tickAt: null };
    return JSON.parse(raw) as LiveSession;
  } catch {
    return { leftSec: 0, rightSec: 0, active: null, tickAt: null };
  }
}

function saveSession(s: LiveSession) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

export function BreastfeedingTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const entries = useAppStore((s) => s.journals.breastfeeding ?? []);
  const [session, setSession] = useState<LiveSession>({
    leftSec: 0,
    rightSec: 0,
    active: null,
    tickAt: null,
  });
  const [now, setNow] = useState(() => Date.now());
  const [savedFlash, setSavedFlash] = useState(false);
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

  const lastSide = useMemo(() => {
    for (const e of entries) {
      const v = `${e.value} ${e.note}`.toLowerCase();
      if (v.includes("лев")) return "left" as Side;
      if (v.includes("прав")) return "right" as Side;
      const f = e.fields?.side;
      if (f === "left" || f === "right") return f;
    }
    return null;
  }, [entries]);

  const suggest: Side | null = lastSide === "left" ? "right" : lastSide === "right" ? "left" : null;

  function start(side: Side) {
    setSession((prev) => {
      const settled = settle(prev);
      return {
        ...settled,
        active: side,
        tickAt: Date.now(),
      };
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
    const L = settled.active === "left" && settled.tickAt
      ? settled.leftSec + Math.floor((Date.now() - settled.tickAt) / 1000)
      : settled.leftSec;
    const R = settled.active === "right" && settled.tickAt
      ? settled.rightSec + Math.floor((Date.now() - settled.tickAt) / 1000)
      : settled.rightSec;
    const sum = L + R;
    if (sum < 5) return;

    const parts: string[] = [];
    if (L > 0) parts.push(`левая ${fmt(L)}`);
    if (R > 0) parts.push(`правая ${fmt(R)}`);
    parts.push(`всего ${fmt(sum)}`);

    addJournalEntry("breastfeeding", {
      date: new Date().toISOString().slice(0, 10),
      value: parts.join(" · "),
      note: "",
      fields: {
        side: L >= R ? "left" : "right",
        leftSec: L,
        rightSec: R,
        totalSec: sum,
      },
    });
    reset();
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  }

  const todayCount = entries.filter(
    (e) => e.date === new Date().toISOString().slice(0, 10),
  ).length;

  return (
    <div className="maya-rise overflow-hidden rounded-[1.5rem] border border-line bg-card/80 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Какая грудь?
          </h2>
          {suggest && !session.active && total === 0 && (
            <p className="mt-1 text-xs text-muted">
              В прошлый раз была {suggest === "left" ? "правая" : "левая"} → начните с{" "}
              <span className="font-semibold text-foreground">
                {suggest === "left" ? "левой" : "правой"}
              </span>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {fmt(total)}
          </p>
          <p className="text-[11px] text-muted">сегодня · {todayCount} кормл.</p>
        </div>
      </div>

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
              className={`relative overflow-hidden rounded-[1.35rem] border px-3 py-5 text-left transition ${
                active
                  ? "maya-noise-pulse border-accent/50 bg-accent-soft"
                  : suggested
                    ? "border-accent/35 bg-accent-soft/40"
                    : "border-line bg-background/50 hover:border-accent/30"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {label}
              </p>
              <p className="font-mono mt-2 text-2xl font-semibold tabular-nums">
                {fmt(sec)}
              </p>
              <p className="mt-2 text-sm font-semibold text-accent">
                {active ? "Пауза" : "Старт"}
              </p>
              {active && (
                <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={total < 5}
          onClick={save}
          className="flex-1 rounded-2xl bg-accent px-4 py-3.5 text-sm font-semibold text-[#ffffff] disabled:opacity-40"
        >
          Сохранить кормление
        </button>
        {(total > 0 || live.active) && (
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl border border-line px-4 py-3.5 text-sm font-semibold text-muted hover:text-foreground"
          >
            Сброс
          </button>
        )}
      </div>

      {savedFlash && (
        <p className="maya-msg-in mt-3 text-sm font-medium text-accent">
          Записано · Мая запомнит для советов
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Можно переключать стороны на ходу — время сложится. Таймер не пропадёт, если
        свернуть экран.
      </p>
    </div>
  );
}
