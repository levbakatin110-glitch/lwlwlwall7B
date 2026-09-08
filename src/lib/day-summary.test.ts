import { describe, expect, it } from "vitest";
import { formatDaySummaryBrief, type DayTotals } from "./day-summary";

const emptyTotals: DayTotals = {
  sleepSec: 0,
  sleepNapSec: 0,
  sleepNightSec: 0,
  sleepCount: 0,
  bfCount: 0,
  bfSec: 0,
  bfLeftSec: 0,
  bfRightSec: 0,
  formulaMl: 0,
  formulaCount: 0,
  solidsCount: 0,
  diaperCount: 0,
  diaperWet: 0,
  diaperDirty: 0,
};

describe("formatDaySummaryBrief", () => {
  it("for a pregnant mom skips baby sleep/feed and lists pregnancy diaries", () => {
    const text = formatDaySummaryBrief({
      name: "Малыш",
      age: null,
      dateLabel: "8 сентября",
      totals: emptyTotals,
      events: [],
      hints: [],
      skipBabyTotals: true,
      headerLines: ["Беременность: ≈ 20-я неделя"],
      extraLines: ["Давление: 120/80", "Сон мамы: 7 ч"],
      allowedDiaries: ["Неделя", "Давление", "Самочувствие", "Визиты"],
    });
    expect(text).toMatch(/Беременность/);
    expect(text).toMatch(/Давление: 120\/80/);
    expect(text).toMatch(/советуй только их/);
    expect(text).not.toMatch(/Подгузники/);
    expect(text).not.toMatch(/Кормления/);
  });
});
