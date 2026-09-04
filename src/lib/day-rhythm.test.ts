import { describe, expect, it } from "vitest";
import { buildDayRhythm } from "./day-rhythm";
import type { JournalEntry } from "./types";

function at(y: number, m: number, d: number, h: number, min: number) {
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function feed(
  id: string,
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
): JournalEntry {
  const start = at(y, m, d, h, min);
  return {
    id,
    date: iso(y, m, d),
    value: "ГВ",
    note: "",
    createdAt: new Date(start).toISOString(),
    fields: { totalSec: 600, startMs: start, endMs: start + 600_000 },
  };
}

function wet(
  id: string,
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
): JournalEntry {
  const start = at(y, m, d, h, min);
  return {
    id,
    date: iso(y, m, d),
    value: "Мокрый",
    note: "",
    createdAt: new Date(start).toISOString(),
    fields: { kind: "wet", startMs: start },
  };
}

function sleep(
  id: string,
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  durMin: number,
): JournalEntry {
  const start = at(y, m, d, h, min);
  return {
    id,
    date: iso(y, m, d),
    value: "дневной",
    note: "",
    createdAt: new Date(start).toISOString(),
    fields: {
      kind: "nap",
      totalSec: durMin * 60,
      startMs: start,
      endMs: start + durMin * 60_000,
    },
  };
}

describe("buildDayRhythm", () => {
  it("predicts next feed from own median gap", () => {
    const feeds: JournalEntry[] = [];
    for (let i = 0; i < 4; i++) {
      feeds.push(feed(String(i), 2026, 4, 10, 8 + i * 2, 0));
    }
    const now = at(2026, 4, 10, 15, 10);
    const rhythm = buildDayRhythm({ breastfeeding: feeds }, now);
    expect(rhythm.nextFeed).not.toBeNull();
    expect(rhythm.nextFeed!.overdue).toBe(false);
    expect(rhythm.nextFeed!.label).toMatch(/16:10|16:0/);
  });

  it("marks feed overdue when pause is longer than own gap", () => {
    const feeds: JournalEntry[] = [];
    for (let i = 0; i < 4; i++) {
      feeds.push(feed(String(i), 2026, 4, 10, 8 + i * 2, 0));
    }
    const now = at(2026, 4, 10, 18, 0);
    const rhythm = buildDayRhythm({ breastfeeding: feeds }, now);
    expect(rhythm.nextFeed?.overdue).toBe(true);
    expect(rhythm.nextFeed?.label).toMatch(/уже около/i);
  });

  it("says the day looks unlike usual when feeds and wets are down", () => {
    const breastfeeding: JournalEntry[] = [];
    const diaper: JournalEntry[] = [];
    for (let day = 3; day <= 9; day++) {
      for (let f = 0; f < 5; f++) {
        breastfeeding.push(feed(`${day}-f${f}`, 2026, 4, day, 8 + f, 0));
      }
      for (let w = 0; w < 4; w++) {
        diaper.push(wet(`${day}-w${w}`, 2026, 4, day, 9 + w, 0));
      }
    }
    breastfeeding.push(feed("today-1", 2026, 4, 10, 8, 0));
    diaper.push(wet("today-w", 2026, 4, 10, 9, 0));
    const now = at(2026, 4, 10, 15, 0);
    const rhythm = buildDayRhythm({ breastfeeding, diaper }, now);
    expect(rhythm.compare.tone).toBe("watch");
    expect(rhythm.compare.phrase).toMatch(/Не похоже/);
  });

  it("says the day looks like usual when counts match", () => {
    const breastfeeding: JournalEntry[] = [];
    const diaper: JournalEntry[] = [];
    for (let day = 3; day <= 10; day++) {
      for (let f = 0; f < 4; f++) {
        breastfeeding.push(feed(`${day}-f${f}`, 2026, 4, day, 8 + f, 0));
      }
      for (let w = 0; w < 3; w++) {
        diaper.push(wet(`${day}-w${w}`, 2026, 4, day, 9 + w, 0));
      }
    }
    const now = at(2026, 4, 10, 15, 0);
    const rhythm = buildDayRhythm({ breastfeeding, diaper }, now);
    expect(rhythm.compare.tone).toBe("ok");
    expect(rhythm.compare.phrase).toMatch(/Похоже на ваши дни/);
  });

  it("does not nag for a day picture when nothing is logged yet", () => {
    const now = at(2026, 4, 10, 15, 0);
    const rhythm = buildDayRhythm({}, now);
    expect(rhythm.compare.phrase).toBe("");
  });

  it("predicts next nap from wake windows", () => {
    const sleeps: JournalEntry[] = [
      sleep("1", 2026, 4, 10, 9, 0, 40),
      sleep("2", 2026, 4, 10, 12, 0, 40),
      sleep("3", 2026, 4, 10, 15, 0, 40),
    ];
    const now = at(2026, 4, 10, 16, 10);
    const rhythm = buildDayRhythm({ sleep: sleeps }, now);
    expect(rhythm.nextSleep).not.toBeNull();
    expect(rhythm.nextSleep!.overdue).toBe(false);
    expect(rhythm.nextSleep!.label).toMatch(/18:00/);
  });
});
