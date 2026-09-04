import { describe, expect, it } from "vitest";
import { resendFromAddress } from "./resend";

describe("resendFromAddress", () => {
  it("sends from the verified Maya domain, not Resend test sender", () => {
    expect(resendFromAddress()).toContain("noreply@hey-maya.ru");
    expect(resendFromAddress()).not.toMatch(/onboarding@resend\.dev/i);
  });
});
