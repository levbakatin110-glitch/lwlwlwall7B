"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  entriesForToday,
  entryTimeMs,
  formatDuration,
  formatGap,
  todayYmd,
} from "@/lib/diary-day";
import {
  LIVE_KEYS,
  liveParse,
  sleepLiveKey,
} from "@/lib/live-session";
import { stopSleepLive, stopWalkLive } from "@/lib/live-timer-actions";
import { useAppStore } from "@/lib/store";
import type { JournalEntry, ModuleId } from "@/lib/types";

type SleepLive = { kind: "nap" | "night"; startedAt: number };
type WalkLive = { startMs: number; from?: string; to?: string };
type BfLive = {
  leftSec: number;
  rightSec: number;
  active: "left" | "right" | null;
  tickAt: number | null;
};
type ContractionLive = { startMs: number };
type KickLive = { count: number; startMs: number };

function latest(entries: JournalEntry[]): JournalEntry | null {
  if (!entries.length) return null;
  return [...entries].sort((a, b) => entryTimeMs(b) - entryTimeMs(a))[0] ?? null;
}

function settleBf(s: BfLive, now: number): BfLive {
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

export function TodayPulse({
  variant,
}: {
  variant: "bar" | "card";
}) {
  const enabled = useAppStore((s) => s.enabledModules ?? []);
  const journals = useAppStore((s) => s.journals ?? {});
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const has = (id: ModuleId) => enabled.includes(id);

  const [now, setNow] = useState(() => Date.now());
  const [tick, setTick] = useState(0);

  const sleepLive = liveParse<SleepLive>(sleepLiveKey("sleep"));
  const momSleepLive = liveParse<SleepLive>(sleepLiveKey("preg_sleep"));
  const walkLive = liveParse<WalkLive>(LIVE_KEYS.walk);
  const bfLiveRaw = liveParse<BfLive>(LIVE_KEYS.bf);
  const contractionLive = liveParse<ContractionLive>(LIVE_KEYS.contractions);
  const kickLive = liveParse<KickLive>(LIVE_KEYS.kicks);

  const bfLive = bfLiveRaw ? settleBf(bfLiveRaw, now) : null;
  const bfRunning = Boolean(bfLive?.active);

  const anyLive = Boolean(
    sleepLive ||
      momSleepLive ||
      walkLive ||
      bfRunning ||
      contractionLive ||
      (kickLive && kickLive.count > 0),
  );

  useEffect(() => {
    const ms = anyLive ? 1000 : 30_000;
    const id = window.setInterval(() => {
      setNow(Date.now());
      setTick((n) => n + 1);
    }, ms);
    return () => window.clearInterval(id);
  }, [anyLive]);

  const waterToday = useMemo(() => {
    void tick;
    return entriesForToday(journals.water ?? []).reduce((s, e) => {
      const n = Number(e.fields?.ml);
      if (Number.isFinite(n)) return s + n;
      const m = e.value.match(/(\d+)\s*мл/i);
      return s + (m ? Number(m[1]) : 0);
    }, 0);
  }, [journals.water, tick]);

  const lastDiaper = has("diaper")
    ? latest(entriesForToday(journals.diaper ?? []))
    : null;
  const lastFeed =
    has("breastfeeding") || has("formula")
      ? latest([
          ...(has("breastfeeding")
            ? entriesForToday(journals.breastfeeding ?? [])
            : []),
          ...(has("formula") ? entriesForToday(journals.formula ?? []) : []),
        ])
      : null;

  const nextRemind = useMemo(() => {
    void tick;
    const nowMs = Date.now();
    const rows = [
      ...(has("preg_meds") ? journals.preg_meds ?? [] : []),
    ]
      .map((e) => {
        if (e.fields?.taken) return null;
        const at = String(e.fields?.remindAt || "");
        const t = Date.parse(at);
        if (!Number.isFinite(t) || t < nowMs - 60_000) return null;
        return {
          t,
          text: String(e.fields?.text || e.note || e.value),
          href: "/m/preg_meds",
        };
      })
      .filter(Boolean) as { t: number; text: string; href: string }[];
    rows.sort((a, b) => a.t - b.t);
    return rows[0] ?? null;
  }, [journals.preg_meds, enabled, tick]);

  const nextVisit = useMemo(() => {
    if (!has("preg_visits")) return null;
    const nowMs = Date.now();
    const rows = (journals.preg_visits ?? [])
      .map((e) => {
        const when = String(e.fields?.when || "");
        const t = Date.parse(when);
        if (!Number.isFinite(t) || t < nowMs) return null;
        return { t, text: String(e.fields?.kind || e.value) };
      })
      .filter(Boolean) as { t: number; text: string }[];
    rows.sort((a, b) => a.t - b.t);
    return rows[0] ?? null;
  }, [journals.preg_visits, enabled]);

  function addWater() {
    addJournalEntry("water", {
      date: todayYmd(),
      value: "200 мл",
      note: "",
      fields: { ml: 200, startMs: Date.now() },
    });
    setTick((n) => n + 1);
  }

  function addDiaper(kind: "wet" | "dirty") {
    const label = kind === "wet" ? "Мокрый" : "Грязный";
    addJournalEntry("diaper", {
      date: todayYmd(),
      value: label,
      note: "",
      fields: { kind, rash: 0, startMs: Date.now() },
    });
    setTick((n) => n + 1);
  }

  function stopSleep(journalId: "sleep" | "preg_sleep") {
    stopSleepLive(journalId, addJournalEntry);
    setTick((n) => n + 1);
  }

  function stopWalk() {
    stopWalkLive(addJournalEntry);
    setTick((n) => n + 1);
  }

  const liveRows: {
    key: string;
    href: string;
    title: string;
    time: string;
    stop?: () => void;
    stopLabel?: string;
  }[] = [];

  if (sleepLive) {
    liveRows.push({
      key: "sleep",
      href: "/m/sleep",
      title: sleepLive.kind === "night" ? "Ночной сон" : "Дневной сон",
      time: formatDuration(Math.floor((now - sleepLive.startedAt) / 1000)),
      stop: () => stopSleep("sleep"),
      stopLabel: "Разбудили",
    });
  }
  if (momSleepLive) {
    liveRows.push({
      key: "preg_sleep",
      href: "/m/preg_sleep",
      title: "Отдых мамы",
      time: formatDuration(Math.floor((now - momSleepLive.startedAt) / 1000)),
      stop: () => stopSleep("preg_sleep"),
      stopLabel: "Готово",
    });
  }
  if (walkLive) {
    liveRows.push({
      key: "walk",
      href: "/m/walk",
      title: "Прогулка",
      time: formatDuration(Math.floor((now - walkLive.startMs) / 1000)),
      stop: stopWalk,
      stopLabel: "Дома",
    });
  }
  if (bfLive && bfRunning) {
    const sec =
      (bfLive.active === "left" ? bfLive.leftSec : bfLive.rightSec) || 0;
    liveRows.push({
      key: "bf",
      href: "/m/breastfeeding",
      title: bfLive.active === "left" ? "ГВ · левая" : "ГВ · правая",
      time: formatDuration(sec),
    });
  }
  if (contractionLive) {
    liveRows.push({
      key: "contr",
      href: "/m/contractions",
      title: "Схватка",
      time: formatDuration(Math.floor((now - contractionLive.startMs) / 1000)),
    });
  }
  if (kickLive && kickLive.count > 0) {
    liveRows.push({
      key: "kicks",
      href: "/m/kicks",
      title: "Шевеления",
      time: `${kickLive.count} · ${formatDuration(Math.floor((now - kickLive.startMs) / 1000))}`,
    });
  }

  if (variant === "bar") {
    if (!liveRows.length) return null;
    return (
      <div className="shrink-0 border-t border-line bg-accent-soft/40 px-3 py-2">
        <div className="flex flex-col gap-1.5">
          {liveRows.map((row) => (
            <div
              key={row.key}
              className="flex items-center gap-2 text-[13px]"
            >
              <Link
                href={row.href}
                className="min-w-0 flex-1 truncate font-medium"
              >
                {row.title}
                <span className="ml-2 font-display tabular-nums text-accent">
                  {row.time}
                </span>
              </Link>
              {row.stop ? (
                <button
                  type="button"
                  onClick={row.stop}
                  className="shrink-0 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-[var(--on-accent,#fff)]"
                >
                  {row.stopLabel}
                </button>
              ) : (
                <Link
                  href={row.href}
                  className="shrink-0 text-[11px] font-semibold text-accent"
                >
                  Открыть
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const showWater = has("water");
  const showDiaper = has("diaper");
  const showFeed = Boolean(lastFeed);
  const showRemind = Boolean(nextRemind);
  const showVisit = Boolean(nextVisit);
  const showCard =
    liveRows.length > 0 ||
    showWater ||
    showDiaper ||
    showFeed ||
    showRemind ||
    showVisit;
  if (!showCard) return null;

  return (
    <section
      className="rounded-[1.5rem] border border-line bg-card/80 px-3.5 py-4"
      aria-label="Сейчас"
    >
      <h2 className="font-display text-xl font-semibold tracking-tight">
        Сейчас
      </h2>
      <ul className="mt-3 divide-y divide-line/70">
        {liveRows.map((row) => (
          <li
            key={row.key}
            className="flex items-center gap-2 py-2.5 first:pt-0"
          >
            <Link href={row.href} className="min-w-0 flex-1">
              <p className="text-[11px] text-muted">{row.title}</p>
              <p className="font-display text-lg font-semibold tabular-nums text-accent">
                {row.time}
              </p>
            </Link>
            {row.stop ? (
              <button
                type="button"
                onClick={row.stop}
                className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-[var(--on-accent,#fff)]"
              >
                {row.stopLabel}
              </button>
            ) : (
              <Link href={row.href} className="text-xs font-semibold text-accent">
                Открыть
              </Link>
            )}
          </li>
        ))}

        {showFeed && lastFeed ? (
          <li className="flex items-center gap-2 py-2.5">
            <Link href="/m/breastfeeding" className="min-w-0 flex-1">
              <p className="text-[11px] text-muted">Последнее кормление</p>
              <p className="text-sm font-medium">
                {lastFeed.value} · {formatGap(entryTimeMs(lastFeed), now)} назад
              </p>
            </Link>
          </li>
        ) : null}

        {showDiaper ? (
          <li className="flex items-center gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted">Подгузник</p>
              <p className="text-sm font-medium">
                {lastDiaper
                  ? `${lastDiaper.value} · ${formatGap(entryTimeMs(lastDiaper), now)} назад`
                  : "ещё не отмечали сегодня"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => addDiaper("wet")}
                className="rounded-lg bg-foreground/[0.06] px-2 py-1.5 text-[11px] font-semibold"
              >
                Мокрый
              </button>
              <button
                type="button"
                onClick={() => addDiaper("dirty")}
                className="rounded-lg bg-foreground/[0.06] px-2 py-1.5 text-[11px] font-semibold"
              >
                Грязный
              </button>
            </div>
          </li>
        ) : null}

        {showWater ? (
          <li className="flex items-center gap-2 py-2.5">
            <Link href="/m/water" className="min-w-0 flex-1">
              <p className="text-[11px] text-muted">Вода сегодня</p>
              <p className="font-display text-lg font-semibold tabular-nums">
                {waterToday} мл
              </p>
            </Link>
            <button
              type="button"
              onClick={addWater}
              className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-[var(--on-accent,#fff)]"
            >
              +200
            </button>
          </li>
        ) : null}

        {showRemind && nextRemind ? (
          <li className="py-2.5">
            <Link href={nextRemind.href}>
              <p className="text-[11px] text-muted">Ближайшее напоминание</p>
              <p className="text-sm font-medium">
                {nextRemind.text} · в{" "}
                {new Date(nextRemind.t).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </Link>
          </li>
        ) : null}

        {showVisit && nextVisit ? (
          <li className="py-2.5 last:pb-0">
            <Link href="/m/preg_visits">
              <p className="text-[11px] text-muted">Визит</p>
              <p className="text-sm font-medium">
                {nextVisit.text} ·{" "}
                {new Date(nextVisit.t).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
