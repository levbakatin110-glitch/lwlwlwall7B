import { localToday } from "@/lib/local-date";
import type { JournalEntry } from "@/lib/types";

export function todayYmd(): string {
  return localToday();
}

export function entriesForToday(entries: JournalEntry[]): JournalEntry[] {
  const today = todayYmd();
  return entries.filter((e) => e.date === today);
}

export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Интервал между двумя метками: «12 мин», «1 ч 4 мин». */
export function formatGap(fromMs: number, toMs: number): string {
  const min = Math.max(0, Math.round((toMs - fromMs) / 60_000));
  if (min < 1) return "<1 мин";
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function entryTimeMs(e: JournalEntry): number {
  if (typeof e.fields?.startMs === "number") return e.fields.startMs;
  if (e.createdAt) {
    const t = Date.parse(e.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(`${e.date}T12:00:00`);
}

/** Минуты бодрствования с конца последнего сна */
export function wakeMinutesSince(entries: JournalEntry[]): number | null {
  const sleeps = entriesForToday(entries)
    .filter((e) => e.fields?.to || e.fields?.totalSec)
    .map((e) => {
      if (typeof e.fields?.to === "string") {
        const t = Date.parse(e.fields.to);
        if (!Number.isNaN(t)) return t;
      }
      return entryTimeMs(e);
    })
    .sort((a, b) => b - a);
  if (!sleeps.length) return null;
  return Math.max(0, Math.floor((Date.now() - sleeps[0]!) / 60_000));
}
