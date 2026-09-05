import { describe, expect, it } from "vitest";
import { saleAmountForPlan, saleAmountForTopup } from "./sales-store";

describe("sale amounts", () => {
  it("uses the live plan prices", () => {
    expect(saleAmountForPlan("m1")).toBeGreaterThan(0);
    expect(saleAmountForPlan("m6")).toBeGreaterThan(saleAmountForPlan("m1"));
    expect(saleAmountForTopup()).toBeGreaterThan(0);
  });
});
