import { BASE_MONTH_RUB, formatRub } from "@/lib/subscription";

export type ValueAudience = "pregnancy" | "baby" | "cycle" | "both" | "general";

export type ValueContext = {
  pregnant: boolean;
  hasChild: boolean;
  trackCycle: boolean;
};

export function resolveValueAudience(ctx: ValueContext): ValueAudience {
  if (ctx.pregnant && ctx.hasChild) return "both";
  if (ctx.pregnant) return "pregnancy";
  if (ctx.hasChild) return "baby";
  if (ctx.trackCycle) return "cycle";
  return "general";
}

export type ValuePitch = {
  eyebrow: string;
  title: string;
  intro: string;
  bullets: readonly string[];
  priceNote: string;
};

const PRICE_NOTE = `Доступ платный — от ${formatRub(BASE_MONTH_RUB)} в месяц. Без скрытых «бесплатных» лимитов: оплатили — открывается всё.`;

const PITCHES: Record<ValueAudience, Omit<ValuePitch, "priceNote">> = {
  pregnancy: {
    eyebrow: "За что вы платите",
    title: "Мая рядом с беременностью",
    intro:
      "Не «ещё один трекер», а помощница, которая помнит ваши недели и отвечает спокойно — когда тревожно, бессонница или непонятно, нормально ли это.",
    bullets: [
      "Дневник беременности: недели, схватки, вес, самочувствие",
      "Чат с Маей про тревоги, сон, подготовку к родам — без осуждения",
      "Напоминания и заметки, чтобы ничего важного не потерять",
      "Круг мам: можно поделиться и услышать «я тоже так»",
      "После родов в том же аккаунте добавите малыша — контекст сохранится",
    ],
  },
  baby: {
    eyebrow: "За что вы платите",
    title: "Мая рядом с малышом",
    intro:
      "Один место, где сходятся сон, кормление и рост — и можно спросить Маю в три часа ночи, не гугля наугад.",
    bullets: [
      "Дневники сна, ГВ, смесей, воды, роста и веса (с ориентирами ВОЗ)",
      "Чат с Маей: режим, прикорм, скачки роста — с учётом возраста малыша",
      "Итог дня и PDF для педиатра, когда нужно показать картину",
      "Гардероб и подсказки по погоде — меньше суеты по утрам",
      "Общение с другими мамами в кружке",
    ],
  },
  cycle: {
    eyebrow: "За что вы платите",
    title: "Мая и ваш цикл",
    intro:
      "Трекер плюс спокойный разговор: можно писать про самочувствие, а не только ставить галочки в календаре.",
    bullets: [
      "Дневник цикла и заметки о самочувствии",
      "Чат с Маей про симптомы и режим — информативно, без диагнозов",
      "Напоминания, чтобы не терять ритм",
      "Когда появится беременность или малыш — всё в том же аккаунте",
    ],
  },
  both: {
    eyebrow: "За что вы платите",
    title: "И беременность, и малыш — в одной Мае",
    intro:
      "Два контекста сразу: Мая держит и беременность, и уже родившегося ребёнка, чтобы не прыгать по разным приложениям.",
    bullets: [
      "Дневники беременности и ухода за малышом в одном месте",
      "Чат с Маей с учётом обоих контекстов",
      "Сон, кормление, рост, итог дня и PDF для врача",
      "Круг мам и спокойная поддержка, когда тяжело одной",
    ],
  },
  general: {
    eyebrow: "За что вы платите",
    title: "Вся Мая в одной подписке",
    intro:
      "Чат, дневники и общение — после оплаты. Без пробных крошек: вы сразу понимаете, за что платите.",
    bullets: [
      "Чат с Маей под ваш контекст",
      "Все дневники: беременность, цикл, малыш, сон, кормление",
      "Итог дня, графики, PDF для педиатра",
      "Общение с другими мамами",
    ],
  },
};

export function getValuePitch(ctx: ValueContext): ValuePitch {
  const audience = resolveValueAudience(ctx);
  const base = PITCHES[audience];
  return { ...base, priceNote: PRICE_NOTE };
}

/** Короткие пункты для экрана тарифов (тот же смысл). */
export function getValuePitchBullets(ctx: ValueContext): readonly string[] {
  return getValuePitch(ctx).bullets;
}
