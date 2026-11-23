import { describe, expect, it } from "vitest";
import { TEETH, teethOf } from "./teeth";

describe("teeth chart", () => {
  it("has two jaws of ten teeth", () => {
    expect(TEETH).toHaveLength(20);
    expect(teethOf("upper")).toHaveLength(10);
    expect(teethOf("lower")).toHaveLength(10);
    expect(new Set(TEETH.map((t) => t.id)).size).toBe(20);
  });

  it("puts the child's right side on the left of the picture", () => {
    expect(teethOf("upper")[0]?.side).toBe("right");
    expect(teethOf("upper")[9]?.side).toBe("left");
    expect(teethOf("lower")[4]?.kind).toBe("central");
  });
});
