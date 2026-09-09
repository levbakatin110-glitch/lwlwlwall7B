import { afterEach, describe, expect, it, vi } from "vitest";
import { describeMediaError, describeMediaPermissionHelp } from "./media-access";

function mockUa(ua: string, standalone = false) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: ua,
      standalone,
      mediaDevices: { getUserMedia: vi.fn() },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      isSecureContext: true,
      matchMedia: (q: string) => ({
        matches: standalone && q.includes("standalone"),
        media: q,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      }),
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("describeMediaError", () => {
  it("explains missing device", () => {
    mockUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(describeMediaError({ name: "NotFoundError" })).toMatch(/не найден/i);
  });

  it("explains busy camera", () => {
    mockUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(describeMediaError({ name: "NotReadableError" })).toMatch(/занята/i);
  });

  it("explains iPhone Safari denial with Settings steps", () => {
    mockUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(describeMediaError({ name: "NotAllowedError" })).toMatch(
      /Настройки iPhone → Safari/i,
    );
  });

  it("explains iPhone home-screen icon separately from Safari", () => {
    mockUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", true);
    const text = describeMediaPermissionHelp();
    expect(text).toMatch(/иконку «Майя»/i);
    expect(text).toMatch(/до «Майя»/i);
    expect(text).not.toMatch(/Safari → Камера/i);
  });

  it("explains Android Chrome denial with site settings", () => {
    mockUa("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0");
    const text = describeMediaError({ name: "NotAllowedError" });
    expect(text).toMatch(/замочек|Настройки сайта|меню ⋮/i);
    expect(text).not.toMatch(/iPhone/i);
  });

  it("explains Android home-screen app permissions", () => {
    mockUa(
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0",
      true,
    );
    const text = describeMediaPermissionHelp();
    expect(text).toMatch(/Приложения → Майя/i);
    expect(text).toMatch(/Разрешения → Камера/i);
  });
});
