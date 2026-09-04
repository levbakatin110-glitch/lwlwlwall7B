import { describe, expect, it } from "vitest";
import {
  burstForWait,
  capacityModel,
  waitSecForBurst,
  waitSecFromQueue,
} from "@/lib/capacity";

describe("waitSecForBurst", () => {
  it("50 people with 50 slots wait nothing", () => {
    expect(waitSecForBurst(50, 50, 5)).toBe(0);
  });

  it("60 people wait 1 second when Maya answers in 5s", () => {
    expect(waitSecForBurst(60, 50, 5)).toBe(1);
  });

  it("100 people wait 5 seconds", () => {
    expect(waitSecForBurst(100, 50, 5)).toBe(5);
  });
});

describe("burstForWait", () => {
  it("1 minute queue is 650 simultaneous sends at 5s/answer", () => {
    expect(burstForWait(50, 5, 60)).toBe(650);
  });
});

describe("capacityModel", () => {
  it("puts a short queue well under a minute", () => {
    const m = capacityModel({
      slots: 50,
      answerSec: 5,
      answerMeasured: false,
      waiting: 20,
    });
    expect(m.waitAt60).toBe(1);
    expect(m.withMinute).toBe(650);
    expect(m.siteTypical).toBe(3250);
    expect(m.nowWaitSec).toBe(2);
  });
});

describe("waitSecFromQueue", () => {
  it("is zero when nobody is waiting", () => {
    expect(waitSecFromQueue(0, 50, 5)).toBe(0);
  });
});
