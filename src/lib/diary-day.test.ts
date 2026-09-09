import { describe, expect, it } from "vitest";
import type { JournalEntry } from "./types";
import { dayLabel, groupEntriesByDay } from "./diary-day";

function e(id: string, date: string, hour: number): JournalEntry {
  return {
    id,
    date,
    value: id,
    note: "",
    fields: { startMs: Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00`) },
  };
}

describe("groupEntriesByDay", () => {
  it("labels today and yesterday and keeps newer first", () => {
    const now = Date.parse("2026-09-09T18:00:00");
    const days = groupEntriesByDay(
      [
        e("a", "2026-09-09", 10),
        e("b", "2026-09-09", 16),
        e("c", "2026-09-08", 12),
      ],
      undefined,
      10,
      now,
    );
    expect(days.map((d) => d.label)).toEqual(["Сегодня", "Вчера"]);
    expect(days[0]!.entries.map((x) => x.id)).toEqual(["b", "a"]);
    expect(dayLabel("2026-09-09", "2026-09-09")).toBe("Сегодня");
  });
});
