/** Тарифы Маи. Оплата (ЮKassa и т.п.) подключим отдельно — пока активация локальная. */

/**
 * ВРЕМЕННО: полный Premium всем (чат без лимита + все дневники).
 * Выставь false и задеплой, когда демо клиентке закончится.
 */
export const TEMP_UNLOCK_ALL = true;

export type PlanId = "free" | "m1" | "m3" | "m6";

export type PaidPlanId = Exclude<PlanId, "free">;

export type SubscriptionState = {
  planId: PlanId;
  /** ISO — до когда действует платный период */
  expiresAt: string | null;
};

export type AiChatUsage = {
  /** YYYY-MM-DD локального дня */
  date: string;
  count: number;
};

/** Бесплатно: столько запросов к ИИ-чату в сутки (жёстко — защита от «потыкать») */
export const FREE_CHAT_LIMIT = 3;

/**
 * Премиум-цена за 1 месяц.
 * Ориентир рынка: Huckleberry Premium ~1,3–1,8k ₽/мес; AI-трекеры часто $10–15.
 */
export const BASE_MONTH_RUB = 1990;

/** На бесплатном: базовые дневники малыша + беременность + цикл */
export const FREE_MODULE_IDS = [
  "growth",
  "breastfeeding",
  "water",
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
  "cycle",
] as const;

export type FreeModuleId = (typeof FREE_MODULE_IDS)[number];

export function isFreeModuleId(id: string): boolean {
  if (TEMP_UNLOCK_ALL) return true;
  return (FREE_MODULE_IDS as readonly string[]).includes(id);
}

export function clampModulesForPlan(
  modules: string[] | undefined,
  premium: boolean,
): string[] {
  const list = [...(modules ?? [])];
  if (TEMP_UNLOCK_ALL || premium) {
    // На время демо сразу включаем все встроенные дневники
    if (TEMP_UNLOCK_ALL) {
      const allBuiltins = [
        "growth",
        "breastfeeding",
        "formula",
        "solids",
        "sleep",
        "vaccines",
        "health",
        "diet",
        "water",
        "walk",
        "diaper",
        "notes",
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
        "cycle",
      ];
      for (const id of allBuiltins) {
        if (!list.includes(id)) list.push(id);
      }
    }
    return list;
  }
  const allowed = FREE_MODULE_IDS as readonly string[];
  const kept = list.filter((id) => allowed.includes(id));
  for (const id of allowed) {
    if (!kept.includes(id)) kept.push(id);
  }
  return kept;
}

export type PlanDef = {
  id: PaidPlanId;
  months: number;
  discountPct: number;
  /** Итого к оплате */
  priceRub: number;
  /** Цена «как будто без скидки» */
  fullPriceRub: number;
  label: string;
  perMonthRub: number;
  blurb: string;
};

function priceFor(months: number, discountPct: number): number {
  const full = BASE_MONTH_RUB * months;
  return Math.round(full * (1 - discountPct / 100));
}

export const PAID_PLANS: PlanDef[] = [
  {
    id: "m1",
    months: 1,
    discountPct: 0,
    priceRub: priceFor(1, 0),
    fullPriceRub: BASE_MONTH_RUB,
    label: "1 месяц",
    perMonthRub: BASE_MONTH_RUB,
    blurb: "Премиум · без обязательств",
  },
  {
    id: "m3",
    months: 3,
    discountPct: 15,
    priceRub: priceFor(3, 15),
    fullPriceRub: BASE_MONTH_RUB * 3,
    label: "3 месяца",
    perMonthRub: Math.round(priceFor(3, 15) / 3),
    blurb: "−15% к месячному",
  },
  {
    id: "m6",
    months: 6,
    discountPct: 25,
    priceRub: priceFor(6, 25),
    fullPriceRub: BASE_MONTH_RUB * 6,
    label: "6 месяцев",
    perMonthRub: Math.round(priceFor(6, 25) / 6),
    blurb: "−25% · лучшая цена Premium",
  },
];

export function planById(id: PlanId): PlanDef | null {
  if (id === "free") return null;
  return PAID_PLANS.find((p) => p.id === id) ?? null;
}

export function emptySubscription(): SubscriptionState {
  return { planId: "free", expiresAt: null };
}

export function emptyAiUsage(today = localToday()): AiChatUsage {
  return { date: today, count: 0 };
}

import { localToday as localTodayFromDate } from "./local-date";

export function localToday(): string {
  return localTodayFromDate();
}

export function isSubscriptionActive(sub: SubscriptionState | null | undefined): boolean {
  if (TEMP_UNLOCK_ALL) return true;
  if (!sub || sub.planId === "free" || !sub.expiresAt) return false;
  const t = Date.parse(sub.expiresAt);
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

export function activatePaidPlan(planId: PaidPlanId, from = new Date()): SubscriptionState {
  const def = planById(planId);
  const months = def?.months ?? 1;
  const ends = new Date(from);
  ends.setMonth(ends.getMonth() + months);
  return {
    planId,
    expiresAt: ends.toISOString(),
  };
}

export function formatRub(n: number): string {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

export function formatExpiry(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function normalizeAiUsage(
  usage: AiChatUsage | null | undefined,
  today = localToday(),
): AiChatUsage {
  if (!usage || usage.date !== today) return emptyAiUsage(today);
  return { date: today, count: Math.max(0, usage.count | 0) };
}

export function freeChatRemaining(
  sub: SubscriptionState | null | undefined,
  usage: AiChatUsage | null | undefined,
): number | null {
  if (isSubscriptionActive(sub)) return null; // без лимита
  const u = normalizeAiUsage(usage);
  return Math.max(0, FREE_CHAT_LIMIT - u.count);
}

export function canSendAiChat(
  sub: SubscriptionState | null | undefined,
  usage: AiChatUsage | null | undefined,
): { ok: true; remaining: number | null } | { ok: false; remaining: 0 } {
  if (isSubscriptionActive(sub)) return { ok: true, remaining: null };
  const left = freeChatRemaining(sub, usage) ?? 0;
  if (left <= 0) return { ok: false, remaining: 0 };
  return { ok: true, remaining: left };
}

/** Что даёт бесплатный / платный */
export const FREE_PERKS = [
  "Дневники беременности, цикла, ГВ, рост и вес, вода",
  `${FREE_CHAT_LIMIT} сообщений Мае в сутки`,
  "Гардероб, моменты, профиль малышей",
];

export const PAID_PERKS = [
  "Безлимитный чат с Маей — тёплая ИИ «как мама маме»",
  "Все дневники: сон малыша, смеси, подгузник, прогулка, диета…",
  "Свои дневники и доработка разделов через ИИ",
  "Итог дня, графики ВОЗ, PDF для педиатра",
  "Приоритет новых фич в Premium",
];
