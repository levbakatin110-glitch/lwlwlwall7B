import { beforeAll, describe, expect, it } from "vitest";

let rl: typeof import("@/lib/rate-limit");

beforeAll(async () => {
  process.env.DATABASE_PATH = ":memory:";
  rl = await import("@/lib/rate-limit");
});

describe("hitRateLimit", () => {
  it("allows up to the limit, then blocks", () => {
    const key = `t:${Math.random()}`;
    expect(rl.hitRateLimit(key, 2, 60).ok).toBe(true);
    expect(rl.hitRateLimit(key, 2, 60).ok).toBe(true);
    const third = rl.hitRateLimit(key, 2, 60);
    expect(third.ok).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThan(0);
    expect(rl.rateLimitExceeded(key, 2, 60)).toBe(true);
  });

  it("keeps keys independent", () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    rl.hitRateLimit(a, 1, 60);
    expect(rl.hitRateLimit(a, 1, 60).ok).toBe(false);
    expect(rl.hitRateLimit(b, 1, 60).ok).toBe(true);
  });
});

describe("requestIp", () => {
  it("prefers x-real-ip, then the last x-forwarded-for hop", () => {
    const withReal = new Request("http://x", {
      headers: { "x-real-ip": "1.1.1.1", "x-forwarded-for": "6.6.6.6, 2.2.2.2" },
    });
    expect(rl.requestIp(withReal)).toBe("1.1.1.1");
    const spoofed = new Request("http://x", {
      headers: { "x-forwarded-for": "6.6.6.6, 2.2.2.2" },
    });
    expect(rl.requestIp(spoofed)).toBe("2.2.2.2");
  });
});
