import { describe, expect, it } from "vitest";
import {
  parseGrowthHeightInput,
  parseGrowthWeightInput,
  parseHeightCm,
  parseWeightKg,
} from "./growth-norms";

describe("growth input", () => {
  it("saves both a child weight and a height above the old 130 cm cap", () => {
    expect(parseGrowthWeightInput("30")).toBe(30);
    expect(parseGrowthHeightInput("142")).toBe(142);
    expect(parseGrowthHeightInput("68 см")).toBe(68);
    expect(parseGrowthWeightInput("8,2 кг")).toBe(8.2);
  });

  it("does not treat a normal baby weight as a delta", () => {
    expect(parseWeightKg("8.2 кг")).toEqual({ kg: 8.2, delta: false });
    expect(parseWeightKg("+0.3 кг")).toEqual({ kg: 0.3, delta: true });
    expect(parseHeightCm("90 см")).toEqual({ cm: 90, delta: false });
    expect(parseHeightCm("142 см")).toEqual({ cm: 142, delta: false });
  });
});
