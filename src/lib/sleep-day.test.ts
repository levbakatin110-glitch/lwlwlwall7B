import { describe, expect, it } from "vitest";
import type { JournalEntry } from "./types";
import {
  buildSleepDays,
  sleepHoursByYmd,
  sleepSecByDay,
  spanFromEntry,
} from "./sleep-day";

function sleep(
  id: string,
  startIso: string,
  endIso: string,
  kind: "nap" | "night",
): JournalEntry {
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  const start = new Date(startMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    id,
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    value: kind,
    note: "",
    fields: {
      kind,
      startMs,
      endMs,
      totalSec: Math.floor((endMs - startMs) / 1000),
    },
  };
}

describe("sleep day model", () => {
  it("counts overnight hours on both calendar days", () => {
    const e = sleep(
      "n1",
      "2026-04-09T22:00:00",
      "2026-04-10T07:00:00",
      "night",
    );
    const span = spanFromEntry(e)!;
    const yest = sleepSecByDay([span], "2026-04-09");
    const today = sleepSecByDay([span], "2026-04-10");
    expect(yest.sleepSec).toBe(2 * 3600);
    expect(today.sleepSec).toBe(7 * 3600);
    expect(today.nightSec).toBe(7 * 3600);
  });

  it("lists last night under today and inserts wake windows", () => {
    const now = Date.parse("2026-04-10T14:00:00");
    const days = buildSleepDays(
      [
        sleep("n1", "2026-04-09T22:00:00", "2026-04-10T07:00:00", "night"),
        sleep("d1", "2026-04-10T10:00:00", "2026-04-10T11:00:00", "nap"),
      ],
      now,
    );
    const today = days.find((d) => d.ymd === "2026-04-10")!;
    expect(today.label).toBe("Сегодня");
    expect(today.sleepSec).toBe((7 + 1) * 3600);
    expect(today.wakeSec).toBe(6 * 3600);
    const types = today.rows.map((r) => r.type);
    expect(types).toEqual(["sleep", "wake", "sleep", "wake"]);
    const current = today.rows.find((r) => r.type === "wake" && r.current);
    expect(current?.type === "wake" && current.startMs).toBe(
      Date.parse("2026-04-10T11:00:00"),
    );
  });

  it("does not treat live sleep as a wake window", () => {
    const now = Date.parse("2026-04-10T21:30:00");
    const spansDay = buildSleepDays(
      [sleep("d1", "2026-04-10T13:00:00", "2026-04-10T14:00:00", "nap")],
      now,
      { kind: "night", startedAt: Date.parse("2026-04-10T20:00:00") },
    );
    const today = spansDay.find((d) => d.ymd === "2026-04-10")!;
    const live = today.rows.find((r) => r.type === "sleep" && r.span.live);
    expect(live).toBeTruthy();
    expect(today.rows.some((r) => r.type === "wake" && r.current)).toBe(false);
  });

  it("puts overnight hours into the spark map for the morning", () => {
    const now = Date.parse("2026-04-10T12:00:00");
    const map = sleepHoursByYmd(
      [sleep("n1", "2026-04-09T22:00:00", "2026-04-10T07:00:00", "night")],
      ["2026-04-09", "2026-04-10"],
      now,
    );
    expect(map.get("2026-04-09")).toBe(2);
    expect(map.get("2026-04-10")).toBe(7);
  });
});
