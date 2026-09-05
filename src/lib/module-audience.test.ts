import { describe, expect, it } from "vitest";
import { withStarterModulesFirst } from "./children";
import {
  applyPayStarterModules,
  filterModulesForNav,
  hasBornChild,
  modulesForAudience,
  shouldShowModule,
} from "./module-audience";
import { BABY_MODULE_IDS, STARTER_ENABLED_MODULES } from "./children";
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

  it("gives a baby-only mom only baby diaries, seven first", () => {
    const ids = modulesForAudience({ pregnant: false, hasChild: true });
    expect(ids).toEqual([...BABY_MODULE_IDS]);
    expect(ids.slice(0, 7)).toEqual([...STARTER_ENABLED_MODULES]);
    expect(ids).not.toContain("kicks");
    expect(ids).not.toContain("cycle");
    expect(ids).not.toContain("diet");
  });

  it("hides other audiences after pay when she only has a baby", () => {
    const next = applyPayStarterModules(
      ["sleep", "walk", "kicks", "cycle", "diet"],
      { pregnant: false, hasChild: true },
    );
    expect(next).toEqual([...BABY_MODULE_IDS]);
    expect(next).not.toContain("kicks");
    expect(next).not.toContain("cycle");
    expect(next).not.toContain("diet");
  });

  it("keeps pregnancy after pay when she is pregnant", () => {
    const next = applyPayStarterModules(["sleep", "kicks", "cycle"], {
      pregnant: true,
      hasChild: true,
    });
    expect(next).toContain("sleep");
    expect(next).toContain("diaper");
    expect(next).toContain("kicks");
    expect(next).not.toContain("cycle");
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
