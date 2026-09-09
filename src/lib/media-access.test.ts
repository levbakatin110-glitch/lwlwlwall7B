import { describe, expect, it } from "vitest";
import { describeMediaError } from "./media-access";

describe("describeMediaError", () => {
  it("explains missing device", () => {
    expect(describeMediaError({ name: "NotFoundError" })).toMatch(/не найден/i);
  });

  it("explains busy camera", () => {
    expect(describeMediaError({ name: "NotReadableError" })).toMatch(/занята/i);
  });
});
