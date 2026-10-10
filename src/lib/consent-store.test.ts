import { beforeAll, describe, expect, it } from "vitest";

let cs: typeof import("@/lib/consent-store");

beforeAll(async () => {
  process.env.DATABASE_PATH = ":memory:";
  cs = await import("@/lib/consent-store");
});

const base = { ip: "1.1.1.1", userAgent: "test" };

describe("consent store", () => {
  it("records PD consent without marketing", () => {
    cs.recordRegistrationConsents({ ...base, email: "a@mail.ru", marketing: false });
    expect(cs.hasPdConsent("A@mail.ru")).toBe(true);
    expect(cs.listMarketingContacts().some((c) => c.email === "a@mail.ru")).toBe(false);
  });

  it("lists marketing opt-ins and keeps them on re-login without the box", () => {
    cs.recordRegistrationConsents({ ...base, email: "b@mail.ru", marketing: true });
    cs.recordRegistrationConsents({ ...base, email: "b@mail.ru", marketing: false });
    const row = cs.listMarketingContacts().find((c) => c.email === "b@mail.ru");
    expect(row?.revokedAt).toBeNull();
  });

  it("adds marketing later and supports revoke", () => {
    cs.recordRegistrationConsents({ ...base, email: "c@mail.ru", marketing: false });
    cs.recordRegistrationConsents({ ...base, email: "c@mail.ru", marketing: true });
    expect(cs.listMarketingContacts().some((c) => c.email === "c@mail.ru")).toBe(true);
    expect(cs.revokeMarketing("c@mail.ru")).toBe(true);
    const row = cs.listMarketingContacts().find((c) => c.email === "c@mail.ru");
    expect(row?.revokedAt).toBeTruthy();
  });

  it("unknown email has no consent", () => {
    expect(cs.hasPdConsent("nobody@mail.ru")).toBe(false);
  });
});
