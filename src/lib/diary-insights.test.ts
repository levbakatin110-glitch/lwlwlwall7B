import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  breastfeedingInsight,
  diaperInsight,
  growthSpark,
} from "./diary-insights";
import type { JournalEntry } from "./types";

function entry(
  partial: Partial<JournalEntry> & { date: string; id: string },
): JournalEntry {
  return {
    value: "",
    note: "",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("breastfeedingInsight", () => {
  it("stays quiet when there is only one feed", () => {
    const now = Date.parse("2026-04-10T15:00:00");
    const view = breastfeedingInsight(
      [
        entry({
          id: "1",
          date: "2026-04-10",
          fields: { totalSec: 600, leftSec: 300, rightSec: 300, startMs: now - 600000, endMs: now },
        }),
      ],
      "2026-03-01",
      now,
    );
    expect(view.insight).toBeNull();
  });

  it("flags a long pause vs own median gap", () => {
    const t0 = Date.parse("2026-04-10T08:00:00");
    const feeds: JournalEntry[] = [];
    for (let i = 0; i < 5; i++) {
      const start = t0 + i * 2.5 * 3600_000;
      feeds.push(
        entry({
          id: String(i),
          date: "2026-04-10",
          fields: {
            totalSec: 600,
            leftSec: 300,
            rightSec: 300,
            startMs: start,
            endMs: start + 600_000,
          },
        }),
      );
    }
    const now = t0 + 5 * 2.5 * 3600_000 + 5 * 3600_000;
    const view = breastfeedingInsight(feeds, "2026-03-01", now);
    expect(view.insight?.tone).toBe("watch");
    expect(view.insight?.title).toMatch(/Пауза/i);
  });

  it("flags left/right imbalance", () => {
    const now = Date.parse("2026-04-10T18:00:00");
    const feeds: JournalEntry[] = [];
    for (let i = 0; i < 6; i++) {
      const start = now - (6 - i) * 3 * 3600_000;
      feeds.push(
        entry({
          id: String(i),
          date: "2026-04-10",
          fields: {
            totalSec: 1200,
            leftSec: 1000,
            rightSec: 50,
            startMs: start,
            endMs: start + 1_200_000,
          },
        }),
      );
    }
    const view = breastfeedingInsight(feeds, "2026-03-01", now);
    expect(view.insight?.title).toMatch(/правая/i);
  });
});

describe("diaperInsight", () => {
  it("warns when a young baby has few wet diapers late in the day", () => {
    const today = "2026-04-10";
    const now = Date.parse("2026-04-10T21:00:00");
    const view = diaperInsight(
      [
        entry({
          id: "1",
          date: today,
          fields: { kind: "wet", startMs: Date.parse("2026-04-10T10:00:00") },
        }),
      ],
      "2026-03-20",
      now,
    );
    expect(view.insight?.tone).toBe("watch");
  });
});

describe("addDaysIso", () => {
  it("crosses month boundary in local calendar", () => {
    expect(addDaysIso("2026-03-31", 1)).toBe("2026-04-01");
  });
});

describe("growthSpark", () => {
  it("hides the week chart until there are two weigh-ins", () => {
    const now = Date.parse("2026-04-10T12:00:00");
    const view = growthSpark(
      [
        entry({
          id: "1",
          date: "2026-04-10",
          fields: { weightKg: 8.2, startMs: now },
        }),
      ],
      now,
    );
    expect(view.spark).toEqual([]);
    expect(view.insight).toBeNull();
  });
});

