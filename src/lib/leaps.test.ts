import { describe, expect, it } from "vitest";
import {
  LEAPS,
  currentLeapIndex,
  dayOfLife,
  leapPhase,
  leapPushText,
  upcomingLeapPushes,
} from "./leaps";

describe("growth leaps", () => {
  it("has ten leaps in order", () => {
    expect(LEAPS).toHaveLength(10);
    expect(LEAPS.map((leap) => leap.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("puts a 5-week-old inside the first fussy phase", () => {
    expect(currentLeapIndex(34)).toBe(0);
    expect(leapPhase(LEAPS[0]!, 34)).toBe("storm");
  });

  it("keeps the calm stretch on the leap that just finished", () => {
    expect(currentLeapIndex(40)).toBe(0);
    expect(leapPhase(LEAPS[0]!, 40)).toBe("sunny");
    expect(leapPhase(LEAPS[1]!, 40)).toBe("ahead");
  });

  it("counts days from the birth date", () => {
    expect(dayOfLife("2026-08-10", new Date(2026, 8, 13))).toBe(34);
  });

  it("schedules a free warning two days before the fussy phase", () => {
    const pushes = upcomingLeapPushes("2026-08-10", new Date(2026, 8, 1, 9, 0, 0));
    const soon = pushes.find((push) => push.id === "leap-1-soon");
    expect(soon?.at.getDate()).toBe(6);
    expect(soon?.at.getHours()).toBe(10);
    expect(leapPushText("soon", LEAPS[0]!).body).not.toMatch(/час|окн|режим/i);
  });
});
