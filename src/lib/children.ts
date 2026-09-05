import type { CareReminder } from "./care-reminders";
import type {
  ChatMessage,
  ChildProfile,
  CustomModule,
  JournalEntry,
  MemoryItem,
  MemoryStory,
  ModuleId,
  WardrobeItem,
} from "./types";
import { OPTIONAL_MODULES } from "./modules";

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyJournals(): Record<string, JournalEntry[]> {
  return Object.fromEntries(
    OPTIONAL_MODULES.map((m) => [m.id, [] as JournalEntry[]]),
  ) as Record<string, JournalEntry[]>;
}

export function emptyChildProfile(partial?: Partial<ChildProfile>): ChildProfile {
  const id = partial?.id || uid();
  return {
    name: "",
    namePending: false,
    photoData: undefined,
    birthDate: "",
    sex: "unknown",
    city: "",
    allergies: "",
    notes: "",
    birthHeightCm: undefined,
    birthWeightKg: undefined,
    ...partial,
    id,
  };
}

export type ChildSpace = {
  enabledModules: ModuleId[];
  customModules: CustomModule[];
  wardrobe: WardrobeItem[];
  memories: MemoryItem[];
  memoryStory: MemoryStory | null;
  journals: Record<string, JournalEntry[]>;
  messages: ChatMessage[];
  demoWardrobeSeeded: boolean;
  /** Напоминания по режиму (кормление, сон…) */
  careReminders: CareReminder[];
};

export function emptyChildSpace(): ChildSpace {
  return {
    enabledModules: [...DEFAULT_ENABLED_MODULES],
    customModules: [],
    wardrobe: [],
    memories: [],
    memoryStory: null,
    journals: emptyJournals(),
    messages: [],
    demoWardrobeSeeded: false,
    careReminders: [],
  };
}

/** Все дневники малыша (меню и витрина). Одежда — отдельная страница, не модуль. */
export const BABY_MODULE_IDS: ModuleId[] = [
  "growth",
  "sleep",
  "breastfeeding",
  "formula",
  "solids",
  "diaper",
  "water",
  "walk",
  "health",
  "vaccines",
];

/** После оплаты: семь главных. Одежду не включаем. */
export const STARTER_ENABLED_MODULES: ModuleId[] = [
  "growth",
  "sleep",
  "breastfeeding",
  "formula",
  "diaper",
  "health",
  "vaccines",
];

/** Стартовый набор дневников малыша. Беременность и цикл — из анкеты. */
export const DEFAULT_ENABLED_MODULES: ModuleId[] = [...STARTER_ENABLED_MODULES];

/** Поднимает битый/частичный space после persist — иначе journals undefined роняет UI */
export function ensureChildSpace(
  sp?: Partial<ChildSpace> | null,
): ChildSpace {
  const base = emptyChildSpace();
  if (!sp || typeof sp !== "object") return base;
  const journalsIn =
    sp.journals && typeof sp.journals === "object" ? sp.journals : {};
  return {
    enabledModules: Array.isArray(sp.enabledModules)
      ? (sp.enabledModules as ModuleId[])
      : [...DEFAULT_ENABLED_MODULES],
    customModules: Array.isArray(sp.customModules) ? sp.customModules : [],
    wardrobe: Array.isArray(sp.wardrobe) ? sp.wardrobe : [],
    memories: Array.isArray(sp.memories) ? sp.memories : [],
    memoryStory: sp.memoryStory ?? null,
    journals: { ...emptyJournals(), ...journalsIn },
    messages: Array.isArray(sp.messages) ? sp.messages : [],
    demoWardrobeSeeded: Boolean(sp.demoWardrobeSeeded),
    careReminders: Array.isArray(sp.careReminders) ? sp.careReminders : [],
  };
}

export function childDisplayName(c: ChildProfile | null | undefined): string {
  if (!c) return "Малыш";
  if (c.namePending) return "Малыш";
  const name = typeof c.name === "string" ? c.name.trim() : "";
  return name || "Малыш";
}

/** Разумные диапазоны для онбординга / профиля */
export function validateBirthHeight(cm: number): string | null {
  if (!Number.isFinite(cm)) return "Укажите рост в см";
  if (cm < 35 || cm > 65) return "Рост при рождении обычно 35–65 см";
  return null;
}

export function validateBirthWeight(kg: number): string | null {
  if (!Number.isFinite(kg)) return "Укажите вес в кг";
  if (kg < 0.5 || kg > 7) {
    return "Проверьте введённые данные. Вес должен быть указан в кг (обычно 0.5–7)";
  }
  return null;
}

export function validateCurrentHeight(cm: number): string | null {
  if (!Number.isFinite(cm)) return "Укажите рост в см";
  if (cm < 40 || cm > 160) return "Рост сейчас обычно 40–160 см — проверьте значение";
  return null;
}

export function validateCurrentWeight(kg: number): string | null {
  if (!Number.isFinite(kg)) return "Укажите вес в кг";
  if (kg < 1 || kg > 50) {
    return "Проверьте введённые данные. Вес должен быть указан в кг";
  }
  return null;
}

export function parseRuNumber(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
