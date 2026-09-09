import { toLocalDateIso } from "@/lib/local-date";
import type { JournalEntry } from "@/lib/types";

export type SleepKind = "nap" | "night";

export type SleepSpan = {
  id: string;
  startMs: number;
  endMs: number;
  kind: SleepKind;
  live?: boolean;
};

export type SleepDayRow =
  | { type: "sleep"; span: SleepSpan }
  | {
      type: "wake";
      startMs: number;
      endMs: number;
      current?: boolean;
    };

export type SleepDayView = {
  ymd: string;
  label: string;
  rows: SleepDayRow[];
  sleepSec: number;
  nightSec: number;
  napSec: number;
  wakeSec: number;
};

const MIN_WAKE_MS = 60_000;

export function ymdStartMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!).getTime();
}

export function addYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return toLocalDateIso(new Date(y!, m! - 1, d! + delta));
}

export function sleepStartMs(e: JournalEntry): number {
  if (typeof e.fields?.startMs === "number") return e.fields.startMs;
  if (typeof e.fields?.from === "string") {
    const t = Date.parse(e.fields.from);
    if (!Number.isNaN(t)) return t;
  }
  if (e.createdAt) {
    const t = Date.parse(e.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(`${e.date}T12:00:00`);
}

export function sleepEndMs(e: JournalEntry): number {
  if (typeof e.fields?.endMs === "number") return e.fields.endMs;
  if (typeof e.fields?.to === "string") {
    const t = Date.parse(e.fields.to);
    if (!Number.isNaN(t)) return t;
  }
  const sec = Number(e.fields?.totalSec);
  if (Number.isFinite(sec) && sec > 0) return sleepStartMs(e) + sec * 1000;
  return sleepStartMs(e);
}

export function sleepDurationSec(span: { startMs: number; endMs: number }): number {
  return Math.max(0, Math.floor((span.endMs - span.startMs) / 1000));
}

export function inferSleepKind(
  startMs: number,
  endMs: number,
  raw?: string,
): SleepKind {
  if (raw === "night" || raw === "nap") return raw;
  const hours = (endMs - startMs) / 3_600_000;
  if (hours >= 4) return "night";
  const h = new Date(startMs).getHours();
  if (h >= 19 || h < 6) return "night";
  return "nap";
}

export function spanFromEntry(e: JournalEntry): SleepSpan | null {
  const startMs = sleepStartMs(e);
  const endMs = sleepEndMs(e);
  if (!Number.isFinite(startMs) || endMs <= startMs) return null;
  const raw = typeof e.fields?.kind === "string" ? e.fields.kind : undefined;
  return {
    id: e.id,
    startMs,
    endMs,
    kind: inferSleepKind(startMs, endMs, raw),
  };
}

export function overlapMs(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function homeYmd(span: SleepSpan): string {
  return toLocalDateIso(new Date(span.endMs));
}

export function dayLabel(ymd: string, todayYmd: string): string {
  if (ymd === todayYmd) return "Сегодня";
  if (ymd === addYmd(todayYmd, -1)) return "Вчера";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

export function collectSleepSpans(
  entries: JournalEntry[],
  live: { kind: SleepKind; startedAt: number } | null,
  now: number,
): SleepSpan[] {
  const out: SleepSpan[] = [];
  for (const e of entries) {
    const span = spanFromEntry(e);
    if (span) out.push(span);
  }
  if (live && now > live.startedAt + 1000) {
    out.push({
      id: "live",
      startMs: live.startedAt,
      endMs: now,
      kind: live.kind,
      live: true,
    });
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

/** Часы сна, пересекающие календарный день — ночь с вечера попадает в утро. */
export function sleepSecByDay(
  spans: SleepSpan[],
  ymd: string,
  untilMs?: number,
): { sleepSec: number; nightSec: number; napSec: number } {
  const from = ymdStartMs(ymd);
  const to = Math.min(ymdStartMs(addYmd(ymd, 1)), untilMs ?? Infinity);
  let sleepSec = 0;
  let nightSec = 0;
  let napSec = 0;
  for (const s of spans) {
    const ms = overlapMs(s.startMs, s.endMs, from, to);
    if (ms <= 0) continue;
    const sec = Math.floor(ms / 1000);
    sleepSec += sec;
    if (s.kind === "night") nightSec += sec;
    else napSec += sec;
  }
  return { sleepSec, nightSec, napSec };
}

function wakeRowsInWindow(
  spans: SleepSpan[],
  win0: number,
  win1: number,
  allowCurrent: boolean,
  now: number,
): Extract<SleepDayRow, { type: "wake" }>[] {
  const rows: Extract<SleepDayRow, { type: "wake" }>[] = [];
  let cursor = win0;
  const covering = spans.filter((s) => s.endMs > win0 && s.startMs < win1);

  for (const s of covering) {
    const gapEnd = Math.min(s.startMs, win1);
    if (gapEnd - cursor >= MIN_WAKE_MS) {
      rows.push({ type: "wake", startMs: cursor, endMs: gapEnd });
    }
    cursor = Math.max(cursor, Math.min(s.endMs, win1));
  }

  const tailEnd = allowCurrent ? now : win1;
  if (tailEnd - cursor >= MIN_WAKE_MS) {
    const sleeping = covering.some((s) => s.live && s.endMs >= now - 2000);
    if (!sleeping) {
      rows.push({
        type: "wake",
        startMs: cursor,
        endMs: tailEnd,
        current: allowCurrent && tailEnd === now,
      });
    }
  }
  return rows;
}

export function currentWakeMs(spans: SleepSpan[], now: number): number | null {
  if (spans.some((s) => s.live)) return null;
  let lastEnd = 0;
  for (const s of spans) lastEnd = Math.max(lastEnd, s.endMs);
  if (lastEnd <= 0 || now <= lastEnd) return null;
  return now - lastEnd;
}

export function buildSleepDays(
  entries: JournalEntry[],
  now: number,
  live: { kind: SleepKind; startedAt: number } | null = null,
  keepDays = 10,
): SleepDayView[] {
  const spans = collectSleepSpans(entries, live, now);
  const todayYmd = toLocalDateIso(new Date(now));
  const views: SleepDayView[] = [];

  for (let i = 0; i < keepDays; i++) {
    const ymd = addYmd(todayYmd, -i);
    const from = ymdStartMs(ymd);
    const next = ymdStartMs(addYmd(ymd, 1));
    const isToday = ymd === todayYmd;
    const until = isToday ? now : next;
    const totals = sleepSecByDay(spans, ymd, until);
    const homeSleeps = spans.filter((s) => homeYmd(s) === ymd);
    const wakes = wakeRowsInWindow(spans, from, until, isToday, now);

    const rows: SleepDayRow[] = [
      ...homeSleeps.map((span) => ({ type: "sleep" as const, span })),
      ...wakes,
    ].sort((a, b) => {
      const as = a.type === "sleep" ? a.span.startMs : a.startMs;
      const bs = b.type === "sleep" ? b.span.startMs : b.startMs;
      return as - bs;
    });

    if (!rows.length && totals.sleepSec <= 0 && !isToday) continue;

    const windowSec = Math.max(0, Math.floor((until - from) / 1000));
    views.push({
      ymd,
      label: dayLabel(ymd, todayYmd),
      rows,
      sleepSec: totals.sleepSec,
      nightSec: totals.nightSec,
      napSec: totals.napSec,
      wakeSec: Math.max(0, windowSec - totals.sleepSec),
    });
  }

  return views;
}

export function sleepHoursByYmd(
  entries: JournalEntry[],
  days: string[],
  now: number,
): Map<string, number> {
  const spans = collectSleepSpans(entries, null, now);
  const map = new Map<string, number>();
  for (const ymd of days) {
    const until =
      ymd === toLocalDateIso(new Date(now)) ? now : ymdStartMs(addYmd(ymd, 1));
    const { sleepSec } = sleepSecByDay(spans, ymd, until);
    map.set(ymd, Math.round((sleepSec / 3600) * 10) / 10);
  }
  return map;
}
