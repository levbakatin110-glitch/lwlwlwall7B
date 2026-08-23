"use client";

import { useEffect, useMemo, useState } from "react";
import { localToday } from "@/lib/local-date";
import { formatSec } from "@/lib/pregnancy";
import { useAppStore } from "@/lib/store";

type Row = { startMs: number; endMs: number | null };

const SESSION_KEY = "maya-contractions-session";

export function ContractionsTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const entries = useAppStore((s) => s.journals.contractions ?? []);
  const [live, setLive] = useState<Row | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) setLive(JSON.parse(raw) as Row);
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
    if (!live || live.endMs) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [live]);

  const durationSec = useMemo(() => {
    if (!live) return 0;
    const end = live.endMs ?? now;
    return Math.max(0, Math.floor((end - live.startMs) / 1000));
  }, [live, now]);

  const lastSaved = entries[0];
  const lastEndMs = lastSaved?.fields?.endMs;
  const intervalSec =
    live && typeof lastEndMs === "number"
      ? Math.max(0, Math.floor((live.startMs - lastEndMs) / 1000))
      : null;

  function start() {
    setLive({ startMs: Date.now(), endMs: null });
    setNow(Date.now());
  }

  function stopAndSave() {
    if (!live || live.endMs) return;
    const endMs = Date.now();
    const dur = Math.max(1, Math.floor((endMs - live.startMs) / 1000));
    const interval =
      typeof lastEndMs === "number"
        ? Math.max(0, Math.floor((live.startMs - lastEndMs) / 1000))
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
        endMs,
      },
    });
    setLive(null);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1600);
  }

  function cancel() {
    setLive(null);
  }

  return (
    <div className="rounded-2xl border border-line bg-card/60 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        Таймер схваток
      </p>
      <p className="font-display mt-2 text-4xl font-semibold tabular-nums tracking-tight">
        {live ? formatSec(durationSec) : "00:00"}
      </p>
      {intervalSec != null && live && !live.endMs && (
        <p className="mt-1 text-xs text-muted">
          От прошлой схватки: {formatSec(intervalSec)}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {!live ? (
          <button
            type="button"
            onClick={start}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
          >
            Начало схватки
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={stopAndSave}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
            >
              Конец · сохранить
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-xl border border-line px-4 py-2.5 text-sm"
            >
              Отмена
            </button>
          </>
        )}
      </div>
      {flash && (
        <p className="mt-2 text-xs text-accent">Схватка записана</p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Если схватки регулярные, длинные и учащаются — свяжитесь с врачом /
        скорой. Мая не ставит диагноз.
      </p>
    </div>
  );
}
