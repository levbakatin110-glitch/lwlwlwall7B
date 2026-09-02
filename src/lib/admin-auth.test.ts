import { describe, expect, it } from "vitest";
import { adminPasswordOk } from "@/lib/admin-auth";

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
