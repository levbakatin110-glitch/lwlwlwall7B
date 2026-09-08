import { describe, expect, it } from "vitest";
import { parseVisitDateTime } from "./visit-date";

describe("parseVisitDateTime", () => {
  it("parses ISO date and optional time", () => {
    const d = parseVisitDateTime("2026-06-04", "");
    expect(d.invalid).toBe(false);
    expect(d.ms).not.toBeNull();
    expect(d.hasTime).toBe(false);
    const t = parseVisitDateTime("2026-06-04", "09:30");
    expect(t.hasTime).toBe(true);
    expect(t.ms).toBeGreaterThan(d.ms!);
  });

  it("parses ru DD.MM.YYYY", () => {
    const a = parseVisitDateTime("04.06.2026", "");
    const b = parseVisitDateTime("2026-06-04", "");
    expect(a.ms).toBe(b.ms);
  });

  it("rejects year 4666 instead of silently dropping the date", () => {
    const bad = parseVisitDateTime("04.06.4666", "");
    expect(bad.invalid).toBe(true);
    expect(bad.ms).toBeNull();
  });

  it("empty date is ok, not invalid", () => {
    expect(parseVisitDateTime("", "")).toEqual({
      ms: null,
      hasTime: false,
      invalid: false,
    });
  });
});
