"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDuration, todayYmd } from "@/lib/diary-day";
import { LIVE_KEYS, liveParse, liveSet, sleepLiveKey } from "@/lib/live-session";
import { useAppStore } from "@/lib/store";

type SleepLive = { kind: "nap" | "night"; startedAt: number };
type BfLive = {
  leftSec: number;
  rightSec: number;
  active: "left" | "right" | null;
  tickAt: number | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function flashOk() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(12);
    } catch {
      /* ignore */
    }
  }
}

/** Крупные кнопки на телефоне: кормлю / спит / подгузник — без ожидания чата. */
export function HomeQuickLog() {
  const router = useRouter();
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);

  const sleep = liveParse<SleepLive>(sleepLiveKey("sleep"));
  const bf = liveParse<BfLive>(LIVE_KEYS.bf);
  const bfOn = Boolean(bf?.active);

  useEffect(() => {
    if (!sleep && !bfOn) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sleep, bfOn]);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 1600);
    return () => window.clearTimeout(t);
  }, [note]);

  function say(text: string) {
    setNote(text);
    flashOk();
  }

  function onFeed() {
    if (bfOn) {
      router.push("/m/breastfeeding");
      return;
    }
    liveSet(
      LIVE_KEYS.bf,
      JSON.stringify({
        leftSec: 0,
        rightSec: 0,
        active: "left",
        tickAt: Date.now(),
      }),
    );
    setNow(Date.now());
    say("Кормление идёт");
  }

  function onSleep() {
    if (sleep) {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - sleep.startedAt) / 1000),
      );
      if (elapsed < 15) {
        liveSet(sleepLiveKey("sleep"), null);
        setNow(Date.now());
        say("Отменила");
        return;
      }
      const startDate = new Date(sleep.startedAt);
      const endDate = new Date();
      const range = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}–${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
      const label = sleep.kind === "night" ? "ночь" : "дневной сон";
      addJournalEntry("sleep", {
        date: todayYmd(),
        value: `${label} ${range} · ${formatDuration(elapsed)}`,
        note: "",
        fields: {
          kind: sleep.kind,
          totalSec: elapsed,
          from: startDate.toISOString(),
          to: endDate.toISOString(),
          startMs: sleep.startedAt,
          endMs: endDate.getTime(),
        },
      });
      liveSet(sleepLiveKey("sleep"), null);
      setNow(Date.now());
      say("Сон записан");
      return;
    }
    liveSet(
      sleepLiveKey("sleep"),
      JSON.stringify({ kind: "nap", startedAt: Date.now() }),
    );
    setNow(Date.now());
    say("Сон идёт");
  }

  function onDiaper() {
    addJournalEntry("diaper", {
      date: todayYmd(),
      value: "Мокрый",
      note: "",
      fields: { kind: "wet", rash: 0, startMs: Date.now() },
    });
    say("Подгузник записан");
  }

  const sleepLabel = sleep
    ? `Разбудили · ${formatDuration(Math.floor((now - sleep.startedAt) / 1000))}`
    : "Спит";
  const feedLabel = bfOn ? "ГВ идёт →" : "Кормлю";

  return (
    <div className="shrink-0 border-b border-line bg-card/80 px-2 pb-2 pt-2 md:hidden">
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={onFeed}
          className="min-h-14 rounded-2xl bg-accent px-1.5 text-[13px] font-semibold leading-tight text-[var(--on-accent,#fff)] active:opacity-80"
        >
          {feedLabel}
        </button>
        <button
          type="button"
          onClick={onSleep}
          className={`min-h-14 rounded-2xl px-1.5 text-[13px] font-semibold leading-tight active:opacity-80 ${
            sleep
              ? "bg-accent text-[var(--on-accent,#fff)]"
              : "border border-line bg-accent-soft text-foreground"
          }`}
        >
          {sleepLabel}
        </button>
        <button
          type="button"
          onClick={onDiaper}
          className="min-h-14 rounded-2xl border border-line bg-accent-soft px-1.5 text-[13px] font-semibold leading-tight text-foreground active:opacity-80"
        >
          Подгузник
        </button>
      </div>
      {note ? (
        <p className="mt-1.5 text-center text-[11px] font-medium text-accent">
          {note}
        </p>
      ) : (
        <p className="mt-1.5 text-center text-[11px] text-muted">
          Одно нажатие · не нужно ждать чат
        </p>
      )}
    </div>
  );
}
