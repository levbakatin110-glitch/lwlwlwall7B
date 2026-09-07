import { describe, expect, it } from "vitest";
import { hideServiceMarkup, stripSuggestMarker } from "@/lib/ai-context";

describe("hideServiceMarkup", () => {
  it("keeps the Russian reply and drops a complete LOG_ENTRY line", () => {
    expect(
      hideServiceMarkup(
        "Записала 200 мл.\nLOG_ENTRY:formula|date=2026-09-07|value=200 мл",
      ),
    ).toBe("Записала 200 мл.");
  });

  it("hides an incomplete command while it is still streaming", () => {
    expect(hideServiceMarkup("Записала 200 мл.\nLOG_ENT")).toBe(
      "Записала 200 мл.",
    );
    expect(hideServiceMarkup("Ок, гляну гардероб.\nSHOW_WARD")).toBe(
      "Ок, гляну гардероб.",
    );
  });

  it("does not swallow ordinary Russian text", () => {
    expect(hideServiceMarkup("Спи хорошо, малыш уже заснул.")).toBe(
      "Спи хорошо, малыш уже заснул.",
    );
  });
});

describe("stripSuggestMarker", () => {
  it("parses LOG_ENTRY but returns clean text for the bubble", () => {
    const parsed = stripSuggestMarker(
      "Записала.\nLOG_ENTRY:formula|date=2026-09-07|value=120 мл",
    );
    expect(parsed.text).toBe("Записала.");
    expect(parsed.logEntries?.[0]?.moduleId).toBe("formula");
    expect(parsed.logEntries?.[0]?.value).toBe("120 мл");
  });
});
