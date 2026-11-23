import type { JournalEntry, WardrobeItem } from "./types";

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function yesterday(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return ymd(d);
}

function sleepHours(entries: JournalEntry[], date: string): number {
  let sec = 0;
  for (const e of entries) {
    if (e.date !== date) continue;
    const raw = e.fields?.totalSec;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) sec += n;
  }
  return Math.round((sec / 3600) * 10) / 10;
}

function formatHours(h: number): string {
  const hours = Math.floor(h);
  const min = Math.round((h - hours) * 60);
  if (hours <= 0) return `${min} мин`;
  if (min <= 0) return `${hours} ч`;
  return `${hours} ч ${min} мин`;
}

/** Утреннее сообщение без запроса к ИИ и без списания пакета. */
export function buildMorningNote(input: {
  name: string;
  journals: Record<string, JournalEntry[]>;
  wardrobe: WardrobeItem[];
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  const day = yesterday(now);
  const prev = new Date(now);
  prev.setDate(prev.getDate() - 2);
  const prevDay = ymd(prev);
  const sleep = input.journals.sleep ?? [];
  const last = sleepHours(sleep, day);
  const before = sleepHours(sleep, prevDay);
  const who = input.name.trim() || "малыш";
  const bits: string[] = [`Доброе утро. Коротко про ${who}.`];
  if (last > 0) {
    let line = `Ночью и днём вчера сон был ${formatHours(last)}.`;
    if (before > 0) {
      const diff = Math.round((last - before) * 60);
      if (diff >= 20) line += ` Это примерно на ${diff} мин больше, чем днём раньше.`;
      else if (diff <= -20) line += ` Это примерно на ${Math.abs(diff)} мин меньше, чем днём раньше.`;
      else line += " Почти как накануне.";
    }
    bits.push(line);
  }
  const clothes = input.wardrobe
    .map((w) => w.name.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (clothes.length > 0) {
    bits.push(
      `На прогулку из гардероба можно начать с: ${clothes.join(" и ")}. Если скажете погоду, подберу точнее.`,
    );
  }
  if (bits.length === 1 && clothes.length === 0) return null;
  return bits.join(" ");
}
