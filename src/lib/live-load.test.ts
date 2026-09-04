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
    estimatedWaitSec: 0,
    rssMb: 400,
    systemUsedPct: 20,
    load1: 0.4,
    cpuCount: 8,
  };

  it("is ok on idle server", () => {
    expect(classifyLoad(base).verdict).toBe("ok");
  });

  it("is ok with a short AI queue under a minute", () => {
    expect(classifyLoad({ ...base, estimatedWaitSec: 8 }).verdict).toBe("ok");
  });

  it("is busy when wait climbs toward a minute", () => {
    expect(classifyLoad({ ...base, estimatedWaitSec: 25 }).verdict).toBe(
      "busy",
    );
  });

  it("is overload when wait exceeds a minute", () => {
    expect(classifyLoad({ ...base, estimatedWaitSec: 70 }).verdict).toBe(
      "overload",
    );
  });

  it("is overload when RAM is almost gone", () => {
    expect(classifyLoad({ ...base, systemUsedPct: 93 }).verdict).toBe(
      "overload",
    );
  });
});
