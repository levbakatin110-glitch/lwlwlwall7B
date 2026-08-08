import type { MemoryItem } from "./types";

export type OnThisDayMoment = {
  memory: MemoryItem;
  /** «Год назад», «2 года назад», «В этот день · 2025» */
  label: string;
  yearsAgo: number;
};

function md(iso: string): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[2]}-${m[3]}`;
}

function yearOf(iso: string): number | null {
  const m = iso.match(/^(\d{4})-/);
  if (!m) return null;
  return Number(m[1]);
}

function yearsLabel(n: number): string {
  if (n === 1) return "Год назад";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return `${n} года назад`;
  }
  return `${n} лет назад`;
}

/** Кадр «в этот день» / «год назад» из моментов */
export function findOnThisDay(
  memories: MemoryItem[],
  today = new Date(),
): OnThisDayMoment | null {
  const todayIso = today.toISOString().slice(0, 10);
  const todayMd = md(todayIso);
  const todayYear = yearOf(todayIso);
  if (!todayMd || todayYear == null) return null;

  const matches = memories
    .map((memory) => {
      const key = md(memory.date);
      const y = yearOf(memory.date);
      if (!key || y == null || key !== todayMd || y >= todayYear) return null;
      return { memory, yearsAgo: todayYear - y };
    })
    .filter((x): x is { memory: MemoryItem; yearsAgo: number } => Boolean(x))
    .sort((a, b) => a.yearsAgo - b.yearsAgo);

  const best = matches[0];
  if (!best) return null;

  const label =
    best.yearsAgo >= 1
      ? yearsLabel(best.yearsAgo)
      : `В этот день · ${best.memory.date.slice(0, 4)}`;

  return {
    memory: best.memory,
    label,
    yearsAgo: best.yearsAgo,
  };
}
