import { describe, expect, it } from "vitest";
import { getValuePitch, resolveValueAudience } from "@/lib/value-pitch";

describe("value pitch names Maya", () => {
  it("does not use the night slogan or nameless она", () => {
    const pitch = getValuePitch({
      pregnant: false,
      hasChild: true,
      trackCycle: false,
    });
    const blob = `${pitch.title} ${pitch.hello} ${pitch.highlight} ${pitch.bullets.join(" ")}`;
    expect(blob).not.toMatch(/Спросите ночью/i);
    expect(pitch.title).toMatch(/Мая/);
    expect(pitch.hello).toMatch(/Я Мая/);
    expect(pitch.pluses.length).toBeGreaterThanOrEqual(5);
  });

  it("picks baby vs pregnancy", () => {
    expect(
      resolveValueAudience({
        pregnant: true,
        hasChild: false,
        trackCycle: false,
      }),
    ).toBe("pregnancy");
    expect(
      resolveValueAudience({
        pregnant: false,
        hasChild: true,
        trackCycle: false,
      }),
    ).toBe("baby");
  });
});
