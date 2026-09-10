import { describe, expect, it } from "vitest";
import { kitchenSlideFromHash } from "./kitchen-widgets";

describe("kitchenSlideFromHash", () => {
  it("opens the matching kitchen slide from a home hash", () => {
    expect(kitchenSlideFromHash("#widget-recipes")).toBe(0);
    expect(kitchenSlideFromHash("#widget-noise")).toBe(1);
    expect(kitchenSlideFromHash("#noise")).toBe(1);
    expect(kitchenSlideFromHash("#widget-reminders")).toBe(2);
    expect(kitchenSlideFromHash("#other")).toBe(-1);
  });
});
