import { describe, expect, it } from "vitest";
import { deAiDash } from "@/lib/de-ai-dash";

describe("deAiDash", () => {
  it("turns spaced em dashes into commas", () => {
    expect(deAiDash("Всё готово, можно начинать")).toBe(
      "Всё готово, можно начинать",
    );
  });

  it("keeps time ranges and empty placeholders", () => {
    expect(deAiDash("ночь 22:00–6:30")).toBe("ночь 22:00–6:30");
    expect(deAiDash("—")).toBe("—");
  });
});
