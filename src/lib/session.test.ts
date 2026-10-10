import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  isSharedPlaceholderEmail,
  verifySessionToken,
} from "@/lib/session";

process.env.AUTH_SECRET = "test-auth-secret-123";

describe("session tokens", () => {
  it("round-trips a real email", () => {
    const token = createSessionToken("mama@mail.ru");
    expect(verifySessionToken(token)).toEqual({ email: "mama@mail.ru" });
  });

  it("never accepts the shared guest address", () => {
    expect(isSharedPlaceholderEmail("temp-guest@hey-maya.local")).toBe(true);
    const token = createSessionToken("temp-guest@hey-maya.local");
    expect(verifySessionToken(token)).toBeNull();
  });
});
