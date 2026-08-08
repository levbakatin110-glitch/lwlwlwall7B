import type { CustomModule, ModuleId } from "./types";

export type ModuleDef = {
  id: ModuleId;
  title: string;
  shortTitle: string;
  description: string;
  /** ключ SVG-иконки, не emoji */
  icon: string;
  valueLabel: string;
  valuePlaceholder: string;
  custom?: boolean;
};

export type AnyModuleDef = Omit<ModuleDef, "id"> & { id: string; custom?: boolean };

export const OPTIONAL_MODULES: ModuleDef[] = [
  {
    id: "growth",
    title: "Рост и вес",
    shortTitle: "Рост и вес",
    description: "Рост и вес по датам.",
    icon: "growth",
    valueLabel: "Показатели",
    valuePlaceholder: "68 см, 8.2 кг",
  },
  {
    id: "breastfeeding",
    title: "Грудное вскармливание",
    shortTitle: "ГВ",
    description: "Таймер левой и правой груди.",
    icon: "feeding",
    valueLabel: "Кормление",
    valuePlaceholder: "15 мин, левая",
  },
  {
    id: "formula",
    title: "Смеси",
    shortTitle: "Смеси",
    description: "Объём и марка смеси.",
    icon: "formula",
    valueLabel: "Порция",
    valuePlaceholder: "120 мл Nutrilon",
  },
  {
    id: "solids",
    title: "Прикорм",
    shortTitle: "Прикорм",
    description: "Продукты и реакция.",
    icon: "solids",
    valueLabel: "Продукт",
    valuePlaceholder: "кабачок 2 ч.л.",
  },
  {
    id: "sleep",
    title: "Сон малыша",
    shortTitle: "Сон",
    description: "Дневной и ночной сон.",
    icon: "sleep",
    valueLabel: "Сон",
    valuePlaceholder: "ночь 22:00–6:30",
  },
  {
    id: "vaccines",
    title: "Прививки",
    shortTitle: "Прививки",
    description: "Сделанные прививки.",
    icon: "vaccines",
    valueLabel: "Прививка",
    valuePlaceholder: "АКДС, 3 мес.",
  },
  {
    id: "health",
    title: "Здоровье",
    shortTitle: "Здоровье",
    description: "Температура и симптомы.",
    icon: "health",
    valueLabel: "Запись",
    valuePlaceholder: "температура 37.2",
  },
  {
    id: "diet",
    title: "Диета",
    shortTitle: "Диета",
    description: "Калории и цель по весу для мамы.",
    icon: "diet",
    valueLabel: "Приём пищи",
    valuePlaceholder: "Обед · 450 ккал",
  },
];

export const MODULE_BY_ID = Object.fromEntries(
  OPTIONAL_MODULES.map((m) => [m.id, m]),
) as Record<ModuleId, ModuleDef>;

export function isBuiltinModuleId(value: string): value is ModuleId {
  return value in MODULE_BY_ID;
}

export function isCustomModuleId(value: string) {
  return value.startsWith("custom-");
}

export function isKnownModuleId(value: string, custom: CustomModule[]) {
  return isBuiltinModuleId(value) || custom.some((c) => c.id === value);
}

export function customToDef(c: CustomModule): AnyModuleDef {
  return {
    id: c.id,
    title: c.title,
    shortTitle: c.title,
    description: c.description,
    icon: c.icon || "spark",
    valueLabel: c.valueLabel || "Запись",
    valuePlaceholder: c.valuePlaceholder || "Напишите как удобно",
    custom: true,
  };
}

export function resolveModule(
  id: string,
  customModules: CustomModule[],
): AnyModuleDef | null {
  if (isBuiltinModuleId(id)) return MODULE_BY_ID[id];
  const custom = customModules.find((c) => c.id === id);
  return custom ? customToDef(custom) : null;
}

/** @deprecated use isBuiltinModuleId */
export const isModuleId = isBuiltinModuleId;
