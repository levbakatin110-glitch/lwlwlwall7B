/** Беременность: ПДР, неделя, короткие подсказки по неделям. */

export type PregnancyProfile = {
  active: boolean;
  /** Предполагаемая дата родов YYYY-MM-DD */
  dueDate: string;
  /** Первый день последних месячных (если знают) */
  lmpDate?: string;
  /** Вес до беременности, кг */
  startWeightKg?: number;
  notes?: string;
  /** Следит за циклом (отдельный трек) */
  trackCycle?: boolean;
  /** План родов — свободный текст */
  birthPlan?: string;
  /** Вопросы к врачу */
  doctorQuestions?: string;
  /** Экстренные контакты */
  emergencyContacts?: string;
  /** Настройки календаря цикла (если следит) */
  cycleLength?: number;
  periodLength?: number;
};

export const PREGNANCY_MODULE_IDS = [
  "pregnancy",
  "contractions",
  "kicks",
  "preg_weight",
  "preg_pressure",
  "preg_symptoms",
  "preg_visits",
  "preg_belly",
  "preg_meds",
  "preg_labs",
  "preg_docs",
  "preg_sleep",
  "birth_plan",
] as const;

export const CYCLE_MODULE_IDS = ["cycle"] as const;

export type PregnancyModuleId = (typeof PREGNANCY_MODULE_IDS)[number];

export function isPregnancyModuleId(id: string): id is PregnancyModuleId {
  return (PREGNANCY_MODULE_IDS as readonly string[]).includes(id);
}

export function emptyPregnancy(): PregnancyProfile {
  return { active: false, dueDate: "" };
}

/** Полных дней беременности от ЛМП или от ПДР−280. */
export function pregnancyAgeDays(
  dueDate: string,
  lmpDate?: string,
  now = new Date(),
): number | null {
  let start: Date | null = null;
  if (lmpDate?.trim()) {
    const d = new Date(`${lmpDate}T12:00:00`);
    if (!Number.isNaN(d.getTime())) start = d;
  }
  if (!start && dueDate?.trim()) {
    const due = new Date(`${dueDate}T12:00:00`);
    if (!Number.isNaN(due.getTime())) {
      start = new Date(due);
      start.setDate(start.getDate() - 280);
    }
  }
  if (!start) return null;
  const days = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(0, Math.min(300, days));
}

/** «38 нед. 6 дн.» */
export function pregnancyAgeLabel(
  dueDate: string,
  lmpDate?: string,
  now = new Date(),
): string | null {
  const days = pregnancyAgeDays(dueDate, lmpDate, now);
  if (days == null) return null;
  const w = Math.floor(days / 7);
  const d = days % 7;
  return `${w} нед. ${d} дн.`;
}

/** Неделя беременности 1…42 (с учётом ЛМП, если есть). */
export function pregnancyWeek(
  dueDate: string,
  lmpDate?: string,
  now = new Date(),
): number | null {
  const days = pregnancyAgeDays(dueDate, lmpDate, now);
  if (days == null) return null;
  return Math.max(1, Math.min(42, Math.floor(days / 7) || 1));
}

export function daysUntilDue(dueDate: string, now = new Date()): number | null {
  if (!dueDate?.trim()) return null;
  const due = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** ПДР из первого дня последних месячных (+280 дней). */
export function dueDateFromLmp(lmpDate: string): string | null {
  if (!lmpDate?.trim()) return null;
  const d = new Date(`${lmpDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 280);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEK_BLURBS: Record<number, { size: string; tip: string }> = {
  4: { size: "маковое зёрнышко", tip: "Тест уже может показать две полоски. Берегите себя." },
  5: { size: "семечко кунжута", tip: "Может появиться тошнота — ешьте часто и понемногу." },
  6: { size: "чечевичка", tip: "Сердце малыша начинает биться — волшебный момент." },
  8: { size: "малинка", tip: "Усталость нормальна. Больше воды и дневной отдых." },
  10: { size: "клубничка", tip: "Органы уже закладываются. Спросите врача про фолиевую кислоту." },
  12: { size: "лайм", tip: "Конец I триместра — многие чувствуют себя чуть легче." },
  16: { size: "авокадо", tip: "Можно почувствовать первые толчки (особенно повторнородящие)." },
  20: { size: "банан", tip: "Середина пути. Часто делают второе УЗИ." },
  24: { size: "кукуруза в початке", tip: "Следите за шевелениями — это важный ориентир." },
  28: { size: "баклажан", tip: "III триместр. Удобная поза для сна — на боку." },
  32: { size: "кокос", tip: "Соберите сумку в роддом заранее, без спешки." },
  36: { size: "салат айсберг", tip: "Малыш почти «готов». Обсудите с врачом план родов." },
  38: { size: "тыква", tip: "Схватки тренировочные vs истинные — учитесь отличать по таймеру." },
  40: { size: "арбуз", tip: "Срок! Спокойствие и связь с врачом / бригадой." },
};

export function weekBlurb(week: number): { size: string; tip: string } {
  const keys = Object.keys(WEEK_BLURBS)
    .map(Number)
    .sort((a, b) => a - b);
  let best = keys[0]!;
  for (const k of keys) {
    if (k <= week) best = k;
  }
  return WEEK_BLURBS[best] ?? {
    size: "маленькое чудо",
    tip: "Слушайте себя и своего врача. Мая — ориентир, не диагноз.",
  };
}

export function trimesterLabel(week: number): string {
  if (week < 13) return "I триместр";
  if (week < 28) return "II триместр";
  return "III триместр";
}

export function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
