import { DEFAULT_ENABLED_MODULES } from "./children";
import { isPregnancyModuleId } from "./pregnancy";
import type { ChildProfile, ModuleId } from "./types";

export function hasBornChild(children: ChildProfile[] | undefined): boolean {
  return (children ?? []).some(
    (c) =>
      Boolean(c.birthDate?.trim()) ||
      (Boolean(c.name?.trim()) && !c.namePending),
  );
}

export function isBabyModuleId(id: string): boolean {
  return (DEFAULT_ENABLED_MODULES as readonly string[]).includes(id);
}

/** Вес мамы убрали из продукта — не показываем нигде в меню. */
export function isRetiredModuleId(id: string): boolean {
  return id === "preg_weight";
}

/** Какие дневники видны в меню: малыш отдельно, беременность — только если беременна. */
export function shouldShowModule(
  id: string,
  ctx: { pregnant: boolean; hasChild: boolean },
): boolean {
  if (isRetiredModuleId(id)) return false;
  if (isPregnancyModuleId(id)) return ctx.pregnant;
  if (id === "diet" || id === "cycle") return !ctx.hasChild;
  if (isBabyModuleId(id)) return ctx.hasChild;
  return true;
}

export function filterModulesForNav(
  enabled: ModuleId[],
  ctx: { pregnant: boolean; hasChild: boolean },
): ModuleId[] {
  return enabled.filter((id) => shouldShowModule(id, ctx));
}
