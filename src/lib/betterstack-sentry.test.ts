import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { betterStackDsn, betterStackEnabled } from "@/lib/betterstack-sentry";

describe("betterStackDsn", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.NEXT_PUBLIC_BETTERSTACK_DSN;
    delete process.env.BETTERSTACK_DSN;
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    process.env = env;
  });

  it("reads NEXT_PUBLIC_BETTERSTACK_DSN first", () => {
    process.env.NEXT_PUBLIC_BETTERSTACK_DSN = " https://a@host/1 ";
    expect(betterStackDsn()).toBe("https://a@host/1");
  });

  it("enabled only in production with dsn", () => {
    process.env.NEXT_PUBLIC_BETTERSTACK_DSN = "https://a@host/1";
    process.env.NODE_ENV = "production";
    expect(betterStackEnabled()).toBe(true);
    process.env.NODE_ENV = "development";
    expect(betterStackEnabled()).toBe(false);
  });
});
