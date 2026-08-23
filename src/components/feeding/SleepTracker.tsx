"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";

type Kind = "nap" | "night";

type SleepLive = {
  kind: Kind;
  startedAt: number;
};

const KEY = "maya-sleep-session";

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SleepTracker({
  journalId = "sleep",
}: {
  journalId?: string;
}) {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const storageKey = journalId === "sleep" ? KEY : `${KEY}-${journalId}`;
  const [live, setLive] = useState<SleepLive | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      setLive(raw ? (JSON.parse(raw) as SleepLive) : null);
    } catch {
      setLive(null);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      if (!live) sessionStorage.removeItem(storageKey);
      else sessionStorage.setItem(storageKey, JSON.stringify(live));
    } catch {
      /* */
    }
  }, [live, storageKey]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [live]);

  const elapsed = useMemo(() => {
    if (!live) return 0;
    return Math.max(0, Math.floor((now - live.startedAt) / 1000));
  }, [live, now]);

  function start(kind: Kind) {
    setHint(null);
    setLive({ kind, startedAt: Date.now() });
  }

  function stop() {
    if (!live) return;
    // короткий тап по ошибке — не пишем в дневник
    if (elapsed < 15) {
      setLive(null);
      setHint(
        journalId === "preg_sleep"
          ? "Слишком коротко (меньше 15 сек) — не записала. Засеките снова, если реально отдыхали."
          : "Слишком коротко (меньше 15 сек) — не записала. Если малыш реально поспал, засеките снова.",
      );
      return;
    }
    const start = new Date(live.startedAt);
    const end = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const range = `${pad(start.getHours())}:${pad(start.getMinutes())}–${pad(end.getHours())}:${pad(end.getMinutes())}`;
    const isMom = journalId === "preg_sleep";
    const label = live.kind === "night" ? "ночь" : "дневной сон";
    addJournalEntry(journalId, {
      date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
      value: `${label} ${range} · ${fmt(elapsed)}`,
      note: "",
      fields: {
        kind: live.kind,
        totalSec: elapsed,
        from: start.toISOString(),
        to: end.toISOString(),
      },
    });
    setLive(null);
    setHint(null);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 2200);
  }

  const isMomSleep = journalId === "preg_sleep";

  return (
    <div className="maya-rise overflow-hidden rounded-[1.5rem] border border-line bg-card/80 p-4 sm:p-5">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        {live
          ? isMomSleep
            ? "Отдыхаю…"
            : "Спит…"
          : isMomSleep
            ? "Засечь отдых"
            : "Засечь сон"}
      </h2>

      {live ? (
        <div className="mt-5 text-center">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">
            {live.kind === "night" ? "Ночной" : "Дневной"}
          </p>
          <p className="font-mono mt-2 text-5xl font-semibold tabular-nums tracking-tight">
            {fmt(elapsed)}
          </p>
          <button
            type="button"
            onClick={stop}
            className="mt-6 w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff]"
          >
            {isMomSleep ? "Проснулась — сохранить" : "Проснулся — сохранить"}
          </button>
          <button
            type="button"
            onClick={() => setLive(null)}
            className="mt-2 w-full py-2 text-xs text-muted hover:text-foreground"
          >
            Отменить
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => start("nap")}
            className="rounded-[1.25rem] border border-line bg-background/50 px-3 py-6 text-left hover:border-accent/35"
          >
            <p className="font-display text-lg font-semibold">Дневной</p>
            <p className="mt-1 text-xs text-muted">
              {isMomSleep ? "Короткий отдых" : "Короткий сон"}
            </p>
          </button>
          <button
            type="button"
            onClick={() => start("night")}
            className="rounded-[1.25rem] border border-line bg-background/50 px-3 py-6 text-left hover:border-accent/35"
          >
            <p className="font-display text-lg font-semibold">Ночной</p>
            <p className="mt-1 text-xs text-muted">До утра</p>
          </button>
        </div>
      )}

      {flash && (
        <p className="maya-msg-in mt-3 text-sm font-medium text-accent">
          {isMomSleep
            ? "Отдых записан · берегите себя"
            : "Сон записан · Мая следит за режимом"}
        </p>
      )}
      {hint && (
        <p className="maya-msg-in mt-3 text-sm text-muted">{hint}</p>
      )}
      {!live && !hint && (
        <p className="mt-3 text-[11px] text-muted">От 15 сек — иначе не сохранится.</p>
      )}
    </div>
  );
}
