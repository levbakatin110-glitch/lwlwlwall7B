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
};

export function emptyChildSpace(): ChildSpace {
  return {
    enabledModules: [
      "growth",
      "sleep",
      "breastfeeding",
      "formula",
      "solids",
      "diet",
    ],
    customModules: [],
    wardrobe: [],
    memories: [],
    memoryStory: null,
    journals: emptyJournals(),
    messages: [],
    demoWardrobeSeeded: false,
  };
}

export function childDisplayName(c: ChildProfile | null | undefined): string {
  if (!c) return "Малыш";
  if (c.namePending || !c.name.trim()) return "Малыш";
  return c.name.trim();
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
