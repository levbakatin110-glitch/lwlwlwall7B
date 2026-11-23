import { describe, expect, it } from "vitest";
import { adminPasswordOk, adminPasswordOkLimited } from "@/lib/admin-auth";

describe("adminPasswordOk", () => {
  it("accepts matching password", () => {
    process.env.ADMIN_PASSWORD = "test-secret";
    expect(adminPasswordOk("test-secret")).toBe(true);
  });

  it("rejects wrong password", () => {
    process.env.ADMIN_PASSWORD = "test-secret";
    expect(adminPasswordOk("wrong")).toBe(false);
  });

  it("rejects empty password", () => {
    expect(adminPasswordOk("")).toBe(false);
    expect(adminPasswordOk(null)).toBe(false);
  });
});

describe("adminPasswordOkLimited", () => {
  it("locks an IP after 5 wrong tries, even for the right password", () => {
    process.env.DATABASE_PATH = ":memory:";
    process.env.ADMIN_PASSWORD = "test-secret";
    const req = new Request("http://x", {
      headers: { "x-real-ip": "203.0.113.7" },
    });
    for (let i = 0; i < 5; i++) {
      expect(adminPasswordOkLimited(req, "wrong")).toBe(false);
    }
    expect(adminPasswordOkLimited(req, "test-secret")).toBe(false);

    const other = new Request("http://x", {
      headers: { "x-real-ip": "203.0.113.8" },
    });
    expect(adminPasswordOkLimited(other, "test-secret")).toBe(true);
  });
});
