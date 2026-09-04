/** Картина дня и прогноз «следующее около…» из ритма этой семьи. Не норма ВОЗ. */

import { addDaysIso } from "./diary-insights";
import { formatDurationRu } from "./day-summary";
import { toLocalDateIso } from "./local-date";
import type { JournalEntry } from "./types";

export type DayCounts = {
  date: string;
  bfCount: number;
  formulaCount: number;
  formulaMl: number;
  feedCount: number;
  wetCount: number;
  dirtyCount: number;
  diaperCount: number;
  sleepSec: number;
  sleepCount: number;
};

export type NextGuess = {
  kind: "feed" | "sleep";
  atMs: number;
  typicalGapMin: number;
  overdue: boolean;
  label: string;
};

export type DayCompare = {
  tone: "ok" | "watch" | "info";
  phrase: string;
};

export type DayRhythm = {
  today: DayCounts;
  compare: DayCompare;
  nextFeed: NextGuess | null;
  nextSleep: NextGuess | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function entryStartMs(e: JournalEntry): number {
  const s = num(e.fields?.startMs);
  if (s != null) return s;
  if (e.createdAt) {
    const t = Date.parse(e.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(`${e.date}T12:00:00`);
}

function entryEndMs(e: JournalEntry): number {
  const end = num(e.fields?.endMs);
  if (end != null) return end;
  const start = entryStartMs(e);
  const sec = num(e.fields?.totalSec);
  if (sec != null && sec > 0) return start + sec * 1000;
  return start;
}

function entrySec(e: JournalEntry): number {
  const fromFields = num(e.fields?.totalSec);
  if (fromFields != null && fromFields > 0) return Math.round(fromFields);
  return 0;
}

function entryMl(e: JournalEntry): number {
  const fromFields = num(e.fields?.ml);
  if (fromFields != null && fromFields > 0) return Math.round(fromFields);
  const m = e.value.match(/(\d+)\s*мл/i);
  return m ? Number(m[1]) : 0;
}

function clockMin(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : Math.round((v[mid - 1]! + v[mid]!) / 2);
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function diaperKind(e: JournalEntry): "wet" | "dirty" | "both" | "dry" | "" {
  const k = String(e.fields?.kind || "");
  if (k === "wet" || k === "dirty" || k === "both" || k === "dry") return k;
  const v = e.value.toLowerCase();
  const wet = /мокр/.test(v);
  const dirty = /грязн/.test(v);
  if (wet && dirty) return "both";
  if (wet) return "wet";
  if (dirty) return "dirty";
  return "";
}

function emptyCounts(date: string): DayCounts {
  return {
    date,
    bfCount: 0,
    formulaCount: 0,
    formulaMl: 0,
    feedCount: 0,
    wetCount: 0,
    dirtyCount: 0,
    diaperCount: 0,
    sleepSec: 0,
    sleepCount: 0,
  };
}

export function countsForDate(
  journals: Record<string, JournalEntry[]>,
  date: string,
  beforeClockMin?: number,
): DayCounts {
  const out = emptyCounts(date);
  const before =
    beforeClockMin == null
      ? null
      : (e: JournalEntry) => clockMin(entryStartMs(e)) <= beforeClockMin;

  const take = (list: JournalEntry[] | undefined) =>
    (list ?? []).filter((e) => e.date === date && (!before || before(e)));

  const bf = take(journals.breastfeeding);
  const formula = take(journals.formula);
  const sleep = take(journals.sleep);
  const diaper = take(journals.diaper);

  out.bfCount = bf.length;
  out.formulaCount = formula.length;
  out.formulaMl = formula.reduce((s, e) => s + entryMl(e), 0);
  out.feedCount = out.bfCount + out.formulaCount;
  out.sleepCount = sleep.length;
  out.sleepSec = sleep.reduce((s, e) => s + entrySec(e), 0);
  out.diaperCount = diaper.length;
  for (const e of diaper) {
    const k = diaperKind(e);
    if (k === "wet" || k === "both") out.wetCount += 1;
    if (k === "dirty" || k === "both") out.dirtyCount += 1;
  }
  return out;
}

function feedEvents(journals: Record<string, JournalEntry[]>): JournalEntry[] {
  return [...(journals.breastfeeding ?? []), ...(journals.formula ?? [])].sort(
    (a, b) => entryEndMs(a) - entryEndMs(b),
  );
}

function nextFromGaps(
  kind: "feed" | "sleep",
  endsAndStarts: { end: number; start: number }[],
  lastEnd: number | null,
  now: number,
  gapMin: { lo: number; hi: number },
  word: { next: string; due: string },
): NextGuess | null {
  if (lastEnd == null) return null;
  const gaps: number[] = [];
  for (const row of endsAndStarts) {
    const gap = (row.start - row.end) / 60_000;
    if (gap >= gapMin.lo && gap <= gapMin.hi) gaps.push(gap);
  }
  const typical = median(gaps);
  if (typical == null) return null;
  const atMs = lastEnd + typical * 60_000;
  const overdue = now > atMs + 12 * 60_000;
  return {
    kind,
    atMs,
    typicalGapMin: typical,
    overdue,
    label: overdue
      ? word.due
      : `${word.next} около ${formatClock(atMs)}`,
  };
}

function buildCompare(today: DayCounts, past: DayCounts[]): DayCompare {
  const bits: string[] = [];
  bits.push(`грудь ${today.bfCount}`);
  if (today.formulaCount > 0) {
    bits.push(
      today.formulaMl > 0
        ? `смесь ${today.formulaMl} мл`
        : `смесь ${today.formulaCount}`,
    );
  }
  bits.push(`мокрых ${today.wetCount}`);
  if (today.sleepSec > 0) bits.push(`сон ${formatDurationRu(today.sleepSec)}`);
  const snapshot = bits.join(" · ");

  const useful = past.filter(
    (d) => d.feedCount + d.wetCount + d.sleepCount + d.diaperCount > 0,
  );
  if (useful.length < 3) {
    if (today.feedCount + today.diaperCount + today.sleepCount === 0) {
      return {
        tone: "info",
        phrase:
          "Отметьте кормление, сон или подгузник — здесь сложится картина дня.",
      };
    }
    return {
      tone: "info",
      phrase: `Сегодня: ${snapshot}. Через несколько дней сравню с вашими обычными днями.`,
    };
  }

  const medFeeds = median(useful.map((d) => d.feedCount)) ?? 0;
  const medWet = median(useful.map((d) => d.wetCount)) ?? 0;
  const off: string[] = [];
  if (medFeeds >= 2 && today.feedCount <= medFeeds - 2) {
    off.push("кормлений меньше");
  } else if (medFeeds >= 2 && today.feedCount >= medFeeds + 2) {
    off.push("кормлений больше");
  }
  if (medWet >= 2 && today.wetCount <= medWet - 2) {
    off.push("мокрых меньше");
  } else if (medWet >= 2 && today.wetCount >= medWet + 2) {
    off.push("мокрых больше");
  }

  if (off.length) {
    return {
      tone: "watch",
      phrase: `Не похоже на ваши дни: ${off.join(", ")}. Обычно к этому часу ≈ ${medFeeds} кормл. и ${medWet} мокрых.`,
    };
  }
  return {
    tone: "ok",
    phrase: `Похоже на ваши дни: ${snapshot}.`,
  };
}

export function buildDayRhythm(
  journals: Record<string, JournalEntry[]>,
  now = Date.now(),
): DayRhythm {
  const todayIso = toLocalDateIso(new Date(now));
  const clock = clockMin(now);
  const today = countsForDate(journals, todayIso, clock);

  const past: DayCounts[] = [];
  for (let i = 1; i <= 7; i++) {
    past.push(countsForDate(journals, addDaysIso(todayIso, -i), clock));
  }

  const feeds = feedEvents(journals).filter(
    (e) => entryEndMs(e) <= now && entryEndMs(e) > now - 7 * 86_400_000,
  );
  const feedPairs: { end: number; start: number }[] = [];
  for (let i = 1; i < feeds.length; i++) {
    feedPairs.push({
      end: entryEndMs(feeds[i - 1]!),
      start: entryStartMs(feeds[i]!),
    });
  }
  const lastFeed = feeds.length ? entryEndMs(feeds[feeds.length - 1]!) : null;
  const nextFeed = nextFromGaps(
    "feed",
    feedPairs,
    lastFeed,
    now,
    { lo: 25, hi: 8 * 60 },
    {
      next: "Следующее кормление",
      due: "По вашему ритму кормление уже около этого времени",
    },
  );

  const sleeps = [...(journals.sleep ?? [])]
    .filter((e) => entryEndMs(e) <= now && entryEndMs(e) > now - 7 * 86_400_000)
    .sort((a, b) => entryEndMs(a) - entryEndMs(b));
  const sleepPairs: { end: number; start: number }[] = [];
  for (let i = 1; i < sleeps.length; i++) {
    sleepPairs.push({
      end: entryEndMs(sleeps[i - 1]!),
      start: entryStartMs(sleeps[i]!),
    });
  }
  const lastSleep = sleeps.length ? entryEndMs(sleeps[sleeps.length - 1]!) : null;
  const nextSleep = nextFromGaps(
    "sleep",
    sleepPairs,
    lastSleep,
    now,
    { lo: 40, hi: 6 * 60 },
    {
      next: "Следующий сон",
      due: "По вашему ритму окно сна уже около этого времени",
    },
  );

  return {
    today,
    compare: buildCompare(today, past),
    nextFeed,
    nextSleep,
  };
}
