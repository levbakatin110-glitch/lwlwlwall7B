"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildDayRhythm } from "@/lib/day-rhythm";
import { formatDurationRu } from "@/lib/day-summary";
import { LIVE_KEYS, liveParse, sleepLiveKey } from "@/lib/live-session";
import { useAppStore } from "@/lib/store";

type SleepLive = { kind: "nap" | "night"; startedAt: number };
type BfLive = { active: "left" | "right" | null };

/** Сегодня одной картинкой + следующее кормление/сон из её ритма. */
export function HomeRhythmCard() {
  const journals = useAppStore((s) => s.journals ?? {});
  const [now, setNow] = useState(() => Date.now());

  const sleepOn = Boolean(liveParse<SleepLive>(sleepLiveKey("sleep")));
  const bfOn = Boolean(liveParse<BfLive>(LIVE_KEYS.bf)?.active);

  useEffect(() => {
    const ms = sleepOn || bfOn ? 1000 : 30_000;
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [sleepOn, bfOn]);

  const rhythm = useMemo(
    () => buildDayRhythm(journals, now),
    [journals, now],
  );
  const { today, compare, nextFeed, nextSleep } = rhythm;

  const feedLine = bfOn
    ? "Кормление идёт"
    : nextFeed?.label ?? null;
  const sleepLine = sleepOn
    ? "Сон идёт"
    : nextSleep?.label ?? null;

  const empty =
    today.feedCount + today.diaperCount + today.sleepCount === 0 &&
    !bfOn &&
    !sleepOn;
  if (empty) return null;

  return (
    <Link
      href="/summary"
      className="block shrink-0 border-b border-line bg-card/70 px-3 py-2.5"
    >
      <div className="flex gap-2 overflow-x-auto text-center text-[11px]">
        <Stat k="ГВ" v={String(today.bfCount)} />
        <Stat
          k="Смесь"
          v={today.formulaMl > 0 ? `${today.formulaMl}` : String(today.formulaCount)}
        />
        <Stat k="Мокрые" v={String(today.wetCount)} />
        <Stat
          k="Сон"
          v={today.sleepSec > 0 ? formatDurationRu(today.sleepSec) : "—"}
        />
      </div>
      <p
        className={`mt-2 text-[12px] leading-snug ${
          compare.tone === "watch" ? "text-amber-800 dark:text-amber-200" : "text-muted"
        }`}
      >
        {compare.phrase}
      </p>
      {feedLine || sleepLine ? (
        <p className="mt-1 text-[12px] font-medium text-foreground">
          {[feedLine, sleepLine].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </Link>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-[3.5rem] flex-1 rounded-xl bg-accent-soft/50 px-1.5 py-1">
      <p className="text-[9px] uppercase tracking-wide text-muted">{k}</p>
      <p className="font-display text-sm font-semibold tabular-nums">{v}</p>
    </div>
  );
}
