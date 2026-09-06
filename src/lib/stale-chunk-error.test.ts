import { describe, expect, it } from "vitest";
import {
  isStaleChunkError,
  isStaleChunkSentryEvent,
  isStaleChunkText,
} from "@/lib/stale-chunk-error";

describe("isStaleChunkError", () => {
  it("catches webpack ChunkLoadError", () => {
    const err = new Error("Loading chunk 5145 failed.");
    err.name = "ChunkLoadError";
    expect(isStaleChunkError(err)).toBe(true);
  });

  it("catches TypeError with the missing Next chunk url", () => {
    expect(
      isStaleChunkError(
        new TypeError(
          "Failed to fetch https://hey-maya.ru/_next/static/chunks/6126.abc.js",
        ),
      ),
    ).toBe(true);
    expect(
      isStaleChunkText(
        "TypeError Не удалось получить https://hey-maya.ru/_next/static/chunks/app/layout-5c09.js",
      ),
    ).toBe(true);
  });

  it("does not hide a normal API failure", () => {
    expect(isStaleChunkError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isStaleChunkError(new Error("Чат не ответил"))).toBe(false);
  });

  it("drops Sentry events whose culprit is a missing Next chunk", () => {
    expect(
      isStaleChunkSentryEvent(
        "TypeError Failed to fetch",
        "https://hey-maya.ru/_next/static/chunks/6126.abc.js",
      ),
    ).toBe(true);
    expect(
      isStaleChunkSentryEvent("TypeError Failed to fetch", "/api/chat"),
    ).toBe(false);
  });
});
