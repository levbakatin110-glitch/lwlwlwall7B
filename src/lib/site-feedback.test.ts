import { describe, expect, it } from "vitest";
import {
  checkFeedbackRateLimit,
  feedbackRateLimitKey,
  markFeedbackSent,
} from "@/lib/site-feedback";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("feedbackRateLimitKey", () => {
  it("prefers email over ip", () => {
    expect(
      feedbackRateLimitKey({ email: "A@Mail.RU", ip: "1.2.3.4" }),
    ).toBe("e:a@mail.ru");
  });

  it("falls back to ip", () => {
    expect(feedbackRateLimitKey({ ip: "1.2.3.4" })).toBe("ip:1.2.3.4");
  });

  it("ignores unknown ip", () => {
    expect(feedbackRateLimitKey({ ip: "unknown" })).toBeNull();
  });
});

describe("feedback rate limit file", () => {
  it("blocks second send within 24h", () => {
    const dir = mkdtempSync(join(tmpdir(), "maya-feedback-"));
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const key = `e:live-load-test-${Date.now()}@example.com`;
      expect(checkFeedbackRateLimit(key)).toEqual({ ok: true });
      markFeedbackSent(key);
      const limited = checkFeedbackRateLimit(key);
      expect(limited.ok).toBe(false);
      if (!limited.ok) {
        expect(limited.retryAfterSec).toBeGreaterThan(0);
      }
    } finally {
      process.chdir(prev);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
