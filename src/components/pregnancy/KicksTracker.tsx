"use client";

import { useEffect, useMemo, useState } from "react";
import { localToday } from "@/lib/local-date";
import { formatSec } from "@/lib/pregnancy";
import { useAppStore } from "@/lib/store";

const SESSION_KEY = "maya-kicks-session";

type KickSession = { count: number; startedAt: number };

export function KicksTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const [count, setCount] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as KickSession;
      if (s?.startedAt && s.count > 0) {
        setStartedAt(s.startedAt);
        setCount(s.count);
      }
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    try {
      if (startedAt == null || count <= 0) {
        sessionStorage.removeItem(SESSION_KEY);
      } else {
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ count, startedAt } satisfies KickSession),
        );
      }
    } catch {
      /* */
    }
  }, [count, startedAt]);

  useEffect(() => {
    if (startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const elapsed = useMemo(() => {
    if (startedAt == null) return 0;
    return Math.max(0, Math.floor((now - startedAt) / 1000));
  }, [startedAt, now]);

  function tap() {
    if (startedAt == null) setStartedAt(Date.now());
    setCount((c) => c + 1);
  }

  function reset() {
    setCount(0);
    setStartedAt(null);
  }

  function save() {
    if (count <= 0) return;
    addJournalEntry("kicks", {
      date: localToday(),
      value: `${count} толчков за ${formatSec(elapsed)}`,
      note: "",
      fields: { count, durationSec: elapsed },
    });
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1600);
    reset();
  }

  return (
    <div className="rounded-2xl border border-line bg-card/60 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        Счёт шевелений
      </p>
      <p className="font-display mt-2 text-4xl font-semibold tabular-nums">
        {count}
      </p>
      <p className="text-xs text-muted">
        {startedAt ? `Сессия ${formatSec(elapsed)}` : "Нажмите при каждом толчке"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={tap}
          className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white"
        >
          + Толчок
        </button>
        <button
          type="button"
          onClick={save}
          disabled={count <= 0}
          className="rounded-xl border border-line px-4 py-3 text-sm font-medium disabled:opacity-40"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-line px-4 py-3 text-sm text-muted"
        >
          Сброс
        </button>
      </div>
      {flash && (
        <p className="mt-2 text-xs text-accent">Сессия сохранена</p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Ориентир многих врачей — около 10 ощутимых шевелений за 2 часа во II–III
        триместре. Если резко меньше обычного — позвоните врачу.
      </p>
    </div>
  );
}
