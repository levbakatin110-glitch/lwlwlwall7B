import { describe, expect, it } from "vitest";
import {
  advanceAfterFire,
  computeNextAt,
  formatHhMm,
  isQuietAt,
  nextIntervalAt,
  nextTimesAt,
  parseHhMm,
  resolveScheduleWrite,
  skipQuiet,
  wallClock,
} from "./care-reminders";

/** UTC+3 как у Москвы: getTimezoneOffset = -180 */
const MSK = -180;

function utc(iso: string): number {
  return Date.parse(iso);
}

describe("parseHhMm", () => {
  it("parses hours", () => {
    expect(parseHhMm("09:00")).toBe(9 * 60);
    expect(parseHhMm("21:30")).toBe(21 * 60 + 30);
    expect(parseHhMm("7:05")).toBe(7 * 60 + 5);
    expect(parseHhMm("bad")).toBeNull();
  });

  it("formats back", () => {
    expect(formatHhMm(9 * 60)).toBe("09:00");
    expect(formatHhMm(21 * 60 + 5)).toBe("21:05");
  });
});

describe("quiet hours", () => {
  it("overnight 22:00–07:00", () => {
    // 23:00 MSK = 20:00 UTC
    expect(isQuietAt(utc("2026-03-01T20:00:00Z"), MSK, "22:00", "07:00")).toBe(
      true,
    );
    // 06:00 MSK = 03:00 UTC
    expect(isQuietAt(utc("2026-03-01T03:00:00Z"), MSK, "22:00", "07:00")).toBe(
      true,
    );
    // 12:00 MSK = 09:00 UTC
    expect(isQuietAt(utc("2026-03-01T09:00:00Z"), MSK, "22:00", "07:00")).toBe(
      false,
    );
  });

  it("skips to quietTo", () => {
    const at = utc("2026-03-01T20:10:00Z"); // 23:10 MSK
    const next = skipQuiet(at, MSK, "22:00", "07:00");
    const wall = wallClock(next, MSK);
    expect(wall.mins).toBe(7 * 60);
  });
});

describe("nextTimesAt", () => {
  it("picks next clock time same day", () => {
    const now = utc("2026-03-01T08:00:00Z"); // 11:00 MSK
    const next = nextTimesAt(now, ["21:00"], MSK);
    const wall = wallClock(next, MSK);
    expect(wall.mins).toBe(21 * 60);
    expect(wall.d).toBe(1);
  });

  it("rolls to next day if time passed", () => {
    const now = utc("2026-03-01T19:00:00Z"); // 22:00 MSK
    const next = nextTimesAt(now, ["21:00"], MSK);
    const wall = wallClock(next, MSK);
    expect(wall.mins).toBe(21 * 60);
    expect(wall.d).toBe(2);
  });
});

describe("nextIntervalAt", () => {
  it("adds interval", () => {
    const now = utc("2026-03-01T09:00:00Z");
    const next = nextIntervalAt(now, 180, MSK);
    expect(next - now).toBe(180 * 60_000);
  });
});

describe("advanceAfterFire", () => {
  it("removes one-shot", () => {
    expect(
      advanceAfterFire({ mode: "once", tzOffsetMin: MSK }, Date.now()),
    ).toBeNull();
  });

  it("advances interval", () => {
    const fired = utc("2026-03-01T09:00:00Z");
    const next = advanceAfterFire(
      { mode: "interval", intervalMin: 120, tzOffsetMin: MSK },
      fired,
    );
    expect(next).toBe(fired + 120 * 60_000);
  });
});

describe("computeNextAt", () => {
  it("interval from last log", () => {
    const now = utc("2026-03-01T12:00:00Z");
    const last = utc("2026-03-01T10:00:00Z");
    const next = computeNextAt(
      {
        id: "care-feed",
        kind: "feed",
        enabled: true,
        mode: "interval",
        intervalMin: 180,
        title: "x",
        body: "y",
        href: "/m/breastfeeding",
        resetOnLog: true,
      },
      now,
      MSK,
      last,
    );
    expect(next).toBe(last + 180 * 60_000);
  });

  it("starts from now if no log", () => {
    const now = utc("2026-03-01T12:00:00Z");
    const next = computeNextAt(
      {
        id: "care-feed",
        kind: "feed",
        enabled: true,
        mode: "interval",
        intervalMin: 180,
        title: "x",
        body: "y",
        href: "/m/breastfeeding",
        resetOnLog: true,
      },
      now,
      MSK,
      null,
    );
    expect(next).toBe(now + 180 * 60_000);
  });

  it("keeps overdue slot so it can fire", () => {
    const now = utc("2026-03-01T14:00:00Z");
    const last = utc("2026-03-01T10:00:00Z");
    const next = computeNextAt(
      {
        id: "care-feed",
        kind: "feed",
        enabled: true,
        mode: "interval",
        intervalMin: 180,
        title: "x",
        body: "y",
        href: "/m/breastfeeding",
        resetOnLog: true,
      },
      now,
      MSK,
      last,
    );
    expect(next).toBe(last + 180 * 60_000);
    expect(next).toBeLessThan(now);
  });

  it("keeps a clock slot for two hours after it was due", () => {
    const now = utc("2026-03-01T10:30:00Z"); // 13:30 MSK, 12:00 was 90 min ago
    const next = computeNextAt(
      {
        id: "care-custom",
        kind: "custom",
        enabled: true,
        mode: "times",
        times: ["12:00"],
        title: "x",
        body: "y",
        href: "/reminders",
      },
      now,
      MSK,
      null,
    );
    const wall = wallClock(next, MSK);
    expect(wall.mins).toBe(12 * 60);
    expect(wall.d).toBe(1);
    expect(next).toBeLessThan(now);
  });

  it("rolls a clock slot after two hours", () => {
    const now = utc("2026-03-01T11:01:00Z"); // 14:01 MSK
    const next = computeNextAt(
      {
        id: "care-custom",
        kind: "custom",
        enabled: true,
        mode: "times",
        times: ["12:00"],
        title: "x",
        body: "y",
        href: "/reminders",
      },
      now,
      MSK,
      null,
    );
    const wall = wallClock(next, MSK);
    expect(wall.mins).toBe(12 * 60);
    expect(wall.d).toBe(2);
  });
});

describe("resolveScheduleWrite", () => {
  it("does not resend for 100 minutes after one fire", () => {
    const sent = utc("2026-03-01T12:00:00Z");
    const now = sent + 100 * 60_000;
    const overdue = sent - 60_000;
    const out = resolveScheduleWrite(
      { nextAt: overdue, mode: "interval", intervalMin: 180 },
      { nextAt: overdue, lastSentAt: sent },
      now,
    );
    expect(out.lastSentAt).toBe(sent);
    expect(out.nextAt).toBeGreaterThan(now);
  });

  it("accepts a new future slot after she logs", () => {
    const sent = utc("2026-03-01T12:00:00Z");
    const now = sent + 20 * 60_000;
    const nextCycle = now + 180 * 60_000;
    const out = resolveScheduleWrite(
      { nextAt: nextCycle, mode: "interval", intervalMin: 180 },
      { nextAt: sent + 180 * 60_000, lastSentAt: sent },
      now,
    );
    expect(out.nextAt).toBe(nextCycle);
  });
});
