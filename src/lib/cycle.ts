/** Цикл: прогноз по среднему и последним «1-й день». */

import { toLocalDateIso } from "./local-date";

export type CycleSettings = {
  /** Длина цикла в днях (обычно 21–35) */
  cycleLength: number;
  /** Длина менструации */
  periodLength: number;
};

export const DEFAULT_CYCLE: CycleSettings = {
  cycleLength: 28,
  periodLength: 5,
};

/** Парсим дату 1-го дня из записи дневника cycle */
export function cycleStartFromEntry(value: string, date: string): string | null {
  if (/1[\s-]*й|первый день|месячные начались|менструац/i.test(value)) {
    return date;
  }
  return null;
}

export function collectPeriodStarts(
  entries: { date: string; value: string; fields?: Record<string, string | number> }[],
): string[] {
  const starts = new Set<string>();
  for (const e of entries) {
    if (e.fields?.kind === "period_start") {
      starts.add(e.date);
      continue;
    }
    const s = cycleStartFromEntry(e.value, e.date);
    if (s) starts.add(s);
  }
  return [...starts].sort();
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalDateIso(d);
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T12:00:00`).getTime();
  const db = new Date(`${b}T12:00:00`).getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

export function estimateCycleLength(
  starts: string[],
  fallback = 28,
): number {
  if (starts.length < 2) return fallback;
  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const g = daysBetween(starts[i - 1]!, starts[i]!);
    if (g >= 18 && g <= 45) gaps.push(g);
  }
  if (!gaps.length) return fallback;
  const avg = Math.round(gaps.reduce((s, n) => s + n, 0) / gaps.length);
  return Math.min(45, Math.max(21, avg));
}

export type CycleDayKind =
  | "period"
  | "fertile"
  | "ovulation"
  | "predicted_period"
  | null;

/**
 * Красим день: все прошлые «1-й день» дают менструацию;
 * от последнего старта — фертильное / овуляция / прогноз следующего цикла.
 */
export function classifyCycleDay(
  date: string,
  starts: string[],
  settings: CycleSettings,
): CycleDayKind {
  if (!starts.length) return null;
  const { cycleLength, periodLength } = settings;
  const sorted = [...starts].sort();

  for (const start of sorted) {
    const di = daysBetween(start, date);
    if (di >= 0 && di < periodLength) return "period";
  }

  const lastStart = sorted[sorted.length - 1]!;
  const dayIndex = daysBetween(lastStart, date);
  if (dayIndex < 0) return null;

  // следующие циклы — прогноз месячных + окно
  if (dayIndex >= cycleLength) {
    const inCycle = dayIndex % cycleLength;
    if (inCycle < periodLength) return "predicted_period";
    const ovu = cycleLength - 14;
    if (inCycle === ovu) return "ovulation";
    if (inCycle >= ovu - 5 && inCycle <= ovu + 1) return "fertile";
    return null;
  }

  const ovu = cycleLength - 14;
  if (dayIndex === ovu) return "ovulation";
  if (dayIndex >= ovu - 5 && dayIndex <= ovu + 1) return "fertile";
  return null;
}

export function nextPeriodDate(
  lastStart: string | null,
  cycleLength: number,
): string | null {
  if (!lastStart) return null;
  return addDays(lastStart, cycleLength);
}

export function ovulationDate(
  lastStart: string | null,
  cycleLength: number,
): string | null {
  if (!lastStart) return null;
  return addDays(lastStart, cycleLength - 14);
}

export function monthMatrix(year: number, month0: number): (string | null)[][] {
  const first = new Date(year, month0, 1);
  const startPad = (first.getDay() + 6) % 7; // пн=0
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toLocalDateIso(new Date(year, month0, d, 12)));
  }
  while (cells.length % 7) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}
