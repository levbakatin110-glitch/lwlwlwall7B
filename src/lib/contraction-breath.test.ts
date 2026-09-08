import { describe, expect, it } from "vitest";
import { breathGuide } from "./contraction-breath";

describe("breathGuide", () => {
  it("starts empty on inhale and fills to the end", () => {
    expect(breathGuide(0).title).toBe("Вдох");
    expect(breathGuide(0).progress).toBeCloseTo(0);
    expect(breathGuide(2000).progress).toBeCloseTo(0.5);
    expect(breathGuide(3999).progress).toBeGreaterThan(0.99);
  });

  it("holds full during pause", () => {
    expect(breathGuide(4000).title).toBe("Пауза");
    expect(breathGuide(4000).progress).toBe(1);
    expect(breathGuide(5999).progress).toBe(1);
  });

  it("empties to the left on exhale, not to 20%", () => {
    expect(breathGuide(6000).title).toBe("Выдох");
    expect(breathGuide(6000).progress).toBeCloseTo(1);
    expect(breathGuide(8000).progress).toBeCloseTo(0.5);
    expect(breathGuide(9999).progress).toBeLessThan(0.01);
  });
});
