import { describe, expect, it } from "vitest";
import {
  activatePaidPlan,
  activatePaidPlanExtending,
} from "./subscription";

describe("activatePaidPlanExtending", () => {
  it("starts from now when there is no live expiry", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const next = activatePaidPlanExtending("m1", null, now);
    expect(next.planId).toBe("m1");
    expect(next.expiresAt).toBe(activatePaidPlan("m1", now).expiresAt);
  });

  it("extends from a future expiry instead of stacking from now", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const liveUntil = "2026-07-01T12:00:00.000Z";
    const next = activatePaidPlanExtending("m1", liveUntil, now);
    expect(next.expiresAt).toBe(
      activatePaidPlan("m1", new Date(liveUntil)).expiresAt,
    );
  });

  it("does not use an already expired date as the base", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const expired = "2026-05-01T12:00:00.000Z";
    const next = activatePaidPlanExtending("m3", expired, now);
    expect(next.expiresAt).toBe(activatePaidPlan("m3", now).expiresAt);
  });
});
