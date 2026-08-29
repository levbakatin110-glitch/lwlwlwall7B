/** Персональный план + разбор и сопровождение */

import { prodamusConfig } from "@/lib/prodamus";

export type PlanTopic = "sleep" | "feed";

export type PlanProductId =
  | "plan_sleep"
  | "plan_feed"
  | "accompany_sleep"
  | "accompany_feed";

export type PlanPaymentKind = "plan" | "accompany";

export const PLAN_BREAKDOWN_RUB = 790;
export const ACCOMPANIMENT_RUB = 1990;
/** Сколько дней сопровождения после оплаты */
export const ACCOMPANIMENT_DAYS = 30;
/** Сколько дней после плана можно писать в чат с вопросами */
export const PLAN_CHAT_DAYS = 3;

/** Подпись в навигации и баннерах */
export const PLAN_TEAM_ENTRY_LABEL = "План + чат";
export const PLAN_TEAM_ENTRY_HINT =
  "План по дневнику и живой чат с консультантом · не врач";
export const PLAN_TEAM_FAB_HINT =
  "План по дневнику и чат с консультантом · не врач";
/** Две строки на плавающей кнопке */
export const PLAN_TEAM_FAB_LINE1 = "план";
export const PLAN_TEAM_FAB_LINE2 = "чат";
/** Имена консультантов для баннеров */
export const PLAN_CONSULTANT_NAMES = "Марина, Юлия и Анна";

export const PLAN_OFFER_TITLE = "План по дневнику + разбор";
export const PLAN_OFFER_HOOK =
  "По записям видно, что режим можно выровнять — соберём понятный план именно под вашего малыша.";

export const PLAN_TOPIC_LABEL: Record<PlanTopic, string> = {
  sleep: "сон",
  feed: "кормление",
};

export const PLAN_TOPIC_LABEL_NOM: Record<PlanTopic, string> = {
  sleep: "Сон",
  feed: "Кормление",
};

export const PLAN_TOPIC_MODULE: Record<PlanTopic, string> = {
  sleep: "sleep",
  feed: "breastfeeding",
};

/** Модули дневника для темы «кормление» */
export const FEED_MODULE_IDS = ["breastfeeding", "formula", "solids"] as const;

export const PLAN_PRODUCT_TITLE: Record<PlanProductId, string> = {
  plan_sleep: "Персональный план + разбор · сон",
  plan_feed: "Персональный план + разбор · кормление",
  accompany_sleep: "Сопровождение месяц · сон",
  accompany_feed: "Сопровождение месяц · кормление",
};

export function planProductForTopic(topic: PlanTopic): PlanProductId {
  return topic === "sleep" ? "plan_sleep" : "plan_feed";
}

export function accompanyProductForTopic(topic: PlanTopic): PlanProductId {
  return topic === "sleep" ? "accompany_sleep" : "accompany_feed";
}

export function priceForProduct(id: PlanProductId): number {
  if (id.startsWith("accompany_")) return ACCOMPANIMENT_RUB;
  return PLAN_BREAKDOWN_RUB;
}

export function topicFromProduct(id: PlanProductId): PlanTopic {
  return id.includes("feed") ? "feed" : "sleep";
}

/** Ключи Prodamus заданы на сервере */
export function planPaymentsConfigured(): boolean {
  const { secret, payform } = prodamusConfig();
  return Boolean(secret && payform);
}

/** Реальная касса: ключи Prodamus + PLAN_PAYMENTS_LIVE=true на сервере */
export function planPaymentsLive(): boolean {
  if (process.env.PLAN_PAYMENTS_LIVE !== "true") return false;
  return planPaymentsConfigured();
}

/**
 * Пока касса не живая — заказ сразу активируется (для теста и до Prodamus).
 * PLAN_ORDERS_BYPASS_PAYMENT=false — жёстко требовать кассу.
 */
export function planPaymentsBypass(): boolean {
  if (planPaymentsLive()) return false;
  if (process.env.PLAN_ORDERS_BYPASS_PAYMENT === "false") return false;
  return true;
}

export const ORDER_STATUS_MOM: Record<string, string> = {
  paid: "Консультант готовит разбор — до 24 часов",
  contacted: "Консультант на связи",
  plan_sent: "План отправлен — можно уточнить в чате",
  clarifying: "Уточняем детали по плану",
  closed: "Разбор завершён",
  accompaniment_active: "Сопровождение · месяц",
  completed: "Завершено",
};

export const PLAN_INCLUDES = [
  "Разбор дневника по сну или кормлению — план именно под вашего малыша",
  "Персональный план на 7–14 дней в PDF",
  `${PLAN_CHAT_DAYS} дня в чате — по плану и любым вопросам про малыша и ваш день`,
  "Живой консультант: смотрит дневники, отвечает в течение суток",
  "Не врач — поддержка, забота и режим, без паники",
] as const;

export const ACCOMPANIMENT_INCLUDES = [
  "30 дней — ведём по дневнику и отвечаем на всё, что волнует",
  "Регулярные касания по записям",
  "Корректировки плана по ходу",
  "Короткий итог в конце месяца",
] as const;
