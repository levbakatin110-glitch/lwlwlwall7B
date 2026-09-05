import {
  BABY_MODULE_IDS,
  STARTER_ENABLED_MODULES,
} from "./children";
import {
  isPregnancyModuleId,
  PREGNANCY_MODULE_IDS,
} from "./pregnancy";
import type { ChildProfile, ModuleId } from "./types";

export type AudienceCtx = {
  pregnant: boolean;
  hasChild: boolean;
  trackCycle?: boolean;
};

export function hasBornChild(children: ChildProfile[] | undefined): boolean {
  return (children ?? []).some(
    (c) =>
      Boolean(c.birthDate?.trim()) ||
      (Boolean(c.name?.trim()) && !c.namePending),
  );
}

export function isBabyModuleId(id: string): boolean {
  return (BABY_MODULE_IDS as readonly string[]).includes(id);
}

/** Дневники только своей анкеты: малыш / беременность / мама. Чужие не подмешиваем. */
export function modulesForAudience(ctx: AudienceCtx): ModuleId[] {
  const out: ModuleId[] = [];
  const seen = new Set<string>();
  const add = (id: ModuleId) => {
    if (seen.has(id) || isRetiredModuleId(id)) return;
    if (!shouldShowModule(id, ctx)) return;
    seen.add(id);
    out.push(id);
  };
  if (ctx.hasChild) {
    for (const id of BABY_MODULE_IDS) add(id);
  }
  if (ctx.pregnant) {
    for (const id of PREGNANCY_MODULE_IDS) add(id as ModuleId);
  }
  if (!ctx.hasChild) {
    add("diet");
    if (ctx.trackCycle) add("cycle");
  }
  return out;
}

/** После оплаты: все дневники своей анкеты. Семёрка малыша уже первая в списке. */
export function applyPayStarterModules(
  enabled: ModuleId[],
  ctx?: AudienceCtx,
): ModuleId[] {
  if (ctx) {
    const base = modulesForAudience(ctx);
    const extra = enabled.filter(
      (id) => shouldShowModule(id, ctx) && !base.includes(id),
    );
    return [...base, ...extra];
  }
  const keep = enabled.filter(
    (id) => isPregnancyModuleId(id) || id === "cycle" || id === "diet",
  );
  const out: ModuleId[] = [];
  const seen = new Set<string>();
  for (const id of [...STARTER_ENABLED_MODULES, ...keep]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Вес мамы, заметки и документы убрали из продукта. */
export function isRetiredModuleId(id: string): boolean {
  return id === "preg_weight" || id === "notes" || id === "preg_docs";
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
