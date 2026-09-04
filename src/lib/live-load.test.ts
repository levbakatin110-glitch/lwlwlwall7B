import { describe, expect, it } from "vitest";
import { classifyLoad } from "@/lib/live-load";
import { screenFromPath } from "@/lib/presence";

describe("screenFromPath", () => {
  it("maps main surfaces", () => {
    expect(screenFromPath("/")).toBe("home");
    expect(screenFromPath("/community")).toBe("community");
    expect(screenFromPath("/m/sleep")).toBe("diary");
    expect(screenFromPath("/pricing?x=1")).toBe("pricing");
    expect(screenFromPath("/plan/abc")).toBe("plan");
  });
});

describe("classifyLoad", () => {
  const base = {
    chatActive: 2,
    chatWaiting: 0,
    maxConcurrent: 50,
    maxWaiting: 120,
    rssMb: 400,
    systemUsedPct: 20,
    load1: 0.4,
    cpuCount: 8,
  };

  it("is ok on idle server", () => {
    expect(classifyLoad(base).verdict).toBe("ok");
  });

  it("is busy when chat is 70%+ full", () => {
    expect(classifyLoad({ ...base, chatActive: 36 }).verdict).toBe("busy");
  });

  it("is overload when chat queue is long", () => {
    expect(classifyLoad({ ...base, chatWaiting: 20 }).verdict).toBe("overload");
  });

  it("is overload when RAM is almost gone", () => {
    expect(classifyLoad({ ...base, systemUsedPct: 93 }).verdict).toBe(
      "overload",
    );
  });
});
