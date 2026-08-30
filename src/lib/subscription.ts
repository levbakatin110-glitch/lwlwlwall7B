/** Тарифы Маи. Оплата через Prodamus. */

import { CHAT_TOPUP_RUB } from "@/lib/chat-quota";

/**
 * ВРЕМЕННО было: полный Premium всем.
 * Выключено: доступ только после оплаты.
 */
export const TEMP_UNLOCK_ALL = false;

/**
 * Без бесплатной пробной: чат, дневники и функции — только с Premium.
 */
export const PAID_ONLY = true;

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

/** Бесплатных сообщений нет (PAID_ONLY). Оставляем константу для совместимости. */
export const FREE_CHAT_LIMIT = 0;

/** Премиум-цена за 1 месяц */
export const BASE_MONTH_RUB = 349;

/** При PAID_ONLY бесплатных дневников нет */
export const FREE_MODULE_IDS = [] as const;

export type FreeModuleId = (typeof FREE_MODULE_IDS)[number];

export function isFreeModuleId(id: string): boolean {
  if (TEMP_UNLOCK_ALL) return true;
  if (PAID_ONLY) return false;
  return (FREE_MODULE_IDS as readonly string[]).includes(id);
}

export function clampModulesForPlan(
  modules: string[] | undefined,
  premium: boolean,
): string[] {
  const list = [...(modules ?? [])];
  if (TEMP_UNLOCK_ALL || premium) return list;
  if (PAID_ONLY) return [];
  const allowed = FREE_MODULE_IDS as readonly string[];
  return list.filter((id) => allowed.includes(id));
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
  if (isSubscriptionActive(sub)) return null; // без дневного лимита
  if (PAID_ONLY) return 0;
  const u = normalizeAiUsage(usage);
  return Math.max(0, FREE_CHAT_LIMIT - u.count);
}

export function canSendAiChat(
  sub: SubscriptionState | null | undefined,
  usage: AiChatUsage | null | undefined,
): { ok: true; remaining: number | null } | { ok: false; remaining: 0 } {
  if (isSubscriptionActive(sub)) return { ok: true, remaining: null };
  if (PAID_ONLY) return { ok: false, remaining: 0 };
  const left = freeChatRemaining(sub, usage) ?? 0;
  if (left <= 0) return { ok: false, remaining: 0 };
  return { ok: true, remaining: left };
}

/** Что даёт доступ без оплаты — при PAID_ONLY ничего */
export const FREE_PERKS: readonly string[] = PAID_ONLY
  ? []
  : [
      "Дневники беременности, цикла, ГВ, рост и вес, вода",
      `${FREE_CHAT_LIMIT} сообщений Мае в сутки`,
      "Гардероб, профиль малышей",
    ];

export const PAID_PERKS = [
  "Чат с Маей и все дневники",
  "Сон, кормление, беременность, цикл, гардероб",
  "Свои дневники и доработка разделов через ИИ",
  "Итог дня, графики ВОЗ, PDF для педиатра",
  "Общение с другими мамами",
  `Если пакет чата кончился — доплата ${CHAT_TOPUP_RUB} ₽`,
] as const;
