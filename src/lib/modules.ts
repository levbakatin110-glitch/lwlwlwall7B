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
  {
    id: "water",
    title: "Вода",
    shortTitle: "Вода",
    description: "Сколько выпито за день — стаканы и миллилитры.",
    icon: "water",
    valueLabel: "Объём",
    valuePlaceholder: "250 мл",
  },
  {
    id: "walk",
    title: "Прогулка",
    shortTitle: "Прогулка",
    description: "Таймер и длительность прогулок с малышом.",
    icon: "walk",
    valueLabel: "Прогулка",
    valuePlaceholder: "40 мин · двор",
  },
  {
    id: "diaper",
    title: "Подгузник",
    shortTitle: "Подгузник",
    description: "Смены: мокрый, грязный или оба.",
    icon: "diaper",
    valueLabel: "Смена",
    valuePlaceholder: "мокрый",
  },
  {
    id: "notes",
    title: "Заметки",
    shortTitle: "Заметки",
    description: "Заметки и напоминания — например, завтра гулять в 18:00.",
    icon: "notes",
    valueLabel: "Текст",
    valuePlaceholder: "Завтра погулять в 18:00",
  },
  {
    id: "pregnancy",
    title: "Беременность по неделям",
    shortTitle: "Неделя",
    description: "Текущая неделя, ПДР и подсказки по сроку.",
    icon: "spark",
    valueLabel: "Заметка",
    valuePlaceholder: "Самочувствие на этой неделе",
  },
  {
    id: "contractions",
    title: "Схватки",
    shortTitle: "Схватки",
    description: "Таймер схваток: длительность и интервал.",
    icon: "pulse",
    valueLabel: "Схватка",
    valuePlaceholder: "45 сек · интервал 8 мин",
  },
  {
    id: "kicks",
    title: "Шевеления",
    shortTitle: "Шевеления",
    description: "Счёт толчков малыша за сессию.",
    icon: "moments",
    valueLabel: "Сессия",
    valuePlaceholder: "12 толчков за 40 мин",
  },
  {
    id: "preg_weight",
    title: "Вес при беременности",
    shortTitle: "Вес мамы",
    description: "Динамика веса мамы по неделям.",
    icon: "growth",
    valueLabel: "Вес",
    valuePlaceholder: "68.5 кг",
  },
  {
    id: "preg_pressure",
    title: "Давление и пульс",
    shortTitle: "Давление",
    description: "АД и пульс — история измерений.",
    icon: "pulse",
    valueLabel: "Измерение",
    valuePlaceholder: "120/80 · пульс 78",
  },
  {
    id: "preg_symptoms",
    title: "Самочувствие",
    shortTitle: "Симптомы",
    description: "Тошнота, отёки, боли — короткие заметки.",
    icon: "health",
    valueLabel: "Как себя чувствую",
    valuePlaceholder: "тошнота утром, усталость",
  },
  {
    id: "preg_visits",
    title: "Визиты и анализы",
    shortTitle: "Визиты",
    description: "Приёмы, УЗИ, анализы и напоминания.",
    icon: "list",
    valueLabel: "Визит",
    valuePlaceholder: "УЗИ · ЖК · 10:30",
  },
  {
    id: "preg_belly",
    title: "Животик",
    shortTitle: "Животик",
    description: "Окружность живота и заметки по фото.",
    icon: "outfit",
    valueLabel: "Окружность / заметка",
    valuePlaceholder: "92 см · фото на 28 нед.",
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
