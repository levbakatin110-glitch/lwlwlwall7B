import { beforeAll, describe, expect, it } from "vitest";

let s: typeof import("@/lib/session");

beforeAll(async () => {
  process.env.AUTH_SECRET = "test-auth-secret-123";
  process.env.DATABASE_PATH = ":memory:";
  s = await import("@/lib/session");
});

describe("session tokens", () => {
  it("round-trips a real email", () => {
    const token = s.createSessionToken("mama@mail.ru");
    expect(s.verifySessionToken(token)).toEqual({ email: "mama@mail.ru" });
  });

  it("never accepts the shared guest address", () => {
    expect(s.isSharedPlaceholderEmail("temp-guest@hey-maya.local")).toBe(true);
    const token = s.createSessionToken("temp-guest@hey-maya.local");
    expect(s.verifySessionToken(token)).toBeNull();
  });

  it("rejects a tampered token", () => {
    const token = s.createSessionToken("mama@mail.ru");
    const [payload] = token.split(".");
    expect(s.verifySessionToken(`${payload}.AAAA`)).toBeNull();
  });
});

describe("revokeAllSessions", () => {
  it("kills tokens issued before the revoke, only for that email", async () => {
    const mine = s.createSessionToken("revoke-me@mail.ru");
    const other = s.createSessionToken("other@mail.ru");
    expect(s.verifySessionToken(mine)).not.toBeNull();

    s.revokeAllSessions("Revoke-Me@mail.ru");
    expect(s.verifySessionToken(mine)).toBeNull();
    expect(s.verifySessionToken(other)).not.toBeNull();

    // новый вход после «выйти везде» снова работает
    await new Promise((r) => setTimeout(r, 5));
    const fresh = s.createSessionToken("revoke-me@mail.ru");
    expect(s.verifySessionToken(fresh)).toEqual({ email: "revoke-me@mail.ru" });
  });
});
