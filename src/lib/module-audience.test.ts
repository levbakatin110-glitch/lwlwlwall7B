import { describe, expect, it } from "vitest";
import { withStarterModulesFirst } from "./children";
import {
  applyPayStarterModules,
  filterModulesForNav,
  hasBornChild,
  shouldShowModule,
} from "./module-audience";
import type { ChildProfile } from "./types";

function child(partial: Partial<ChildProfile>): ChildProfile {
  return {
    id: "c1",
    name: "",
    birthDate: "",
    sex: "unknown",
    city: "",
    allergies: "",
    notes: "",
    ...partial,
  };
}

describe("module audience", () => {
  it("treats a named baby with a birth date as a child", () => {
    expect(hasBornChild([child({ name: "Лев", birthDate: "2026-01-01" })])).toBe(
      true,
    );
  });

  it("does not treat a pregnancy placeholder as a child", () => {
    expect(hasBornChild([child({ namePending: true })])).toBe(false);
  });

  it("hides pregnancy diaries when she already has a baby and is not pregnant", () => {
    const ctx = { pregnant: false, hasChild: true };
    expect(shouldShowModule("sleep", ctx)).toBe(true);
    expect(shouldShowModule("growth", ctx)).toBe(true);
    expect(shouldShowModule("notes", ctx)).toBe(false);
    expect(shouldShowModule("preg_sleep", ctx)).toBe(false);
    expect(shouldShowModule("preg_weight", ctx)).toBe(false);
    expect(shouldShowModule("pregnancy", ctx)).toBe(false);
    expect(shouldShowModule("diet", ctx)).toBe(false);
    expect(shouldShowModule("cycle", ctx)).toBe(false);
  });

  it("hides baby-care diaries while pregnant with no child yet", () => {
    const ctx = { pregnant: true, hasChild: false };
    expect(shouldShowModule("diaper", ctx)).toBe(false);
    expect(shouldShowModule("kicks", ctx)).toBe(true);
    expect(shouldShowModule("preg_weight", ctx)).toBe(false);
    expect(shouldShowModule("preg_docs", ctx)).toBe(false);
  });

  it("shows both groups when pregnant and already has a child", () => {
    const ctx = { pregnant: true, hasChild: true };
    const shown = filterModulesForNav(
      ["sleep", "kicks", "preg_weight", "growth", "notes", "preg_docs"],
      ctx,
    );
    expect(shown).toEqual(["sleep", "kicks", "growth"]);
  });

  it("keeps pregnancy after pay and drops extra baby diaries", () => {
    const next = applyPayStarterModules([
      "sleep",
      "walk",
      "water",
      "solids",
      "kicks",
      "cycle",
    ]);
    expect(next).toContain("sleep");
    expect(next).toContain("diaper");
    expect(next).toContain("kicks");
    expect(next).toContain("cycle");
    expect(next).not.toContain("walk");
    expect(next).not.toContain("water");
    expect(next).not.toContain("solids");
    expect(next).toHaveLength(9);
  });

  it("puts the seven core baby diaries first", () => {
    const ids = withStarterModulesFirst(
      ["walk", "vaccines", "sleep", "growth", "water"],
      (id) => id,
    );
    expect(ids.slice(0, 3)).toEqual(["growth", "sleep", "vaccines"]);
    expect(ids.slice(3)).toEqual(["walk", "water"]);
  });
});
