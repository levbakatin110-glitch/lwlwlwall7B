/** Персональный план + разбор и сопровождение */

import { prodamusConfig } from "@/lib/prodamus";

export type PlanTopic = "sleep" | "feed";

export type PlanProductId =
  | "plan_sleep"
  | "plan_feed"
  | "accompany_sleep"
  | "accompany_feed";

export type PlanPaymentKind = "plan" | "accompany";

export const PLAN_BREAKDOWN_RUB = 1490;
export const ACCOMPANIMENT_RUB = 1990;
/** Сколько дней после плана можно писать в чат с вопросами */
export const PLAN_CHAT_DAYS = 3;

/** Имя в чате (человек из команды, не врач и не ИИ-бот Мая) */
export const PLAN_TEAM_DISPLAY_NAME = "Команда Маи";
/** @deprecated используйте PLAN_TEAM_DISPLAY_NAME */
export const SPECIALIST_DISPLAY_NAME = PLAN_TEAM_DISPLAY_NAME;

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
  accompany_sleep: "Сопровождение неделю · сон",
  accompany_feed: "Сопровождение неделю · кормление",
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
  paid: "Команда Маи готовит разбор — до 24 часов",
  contacted: "Команда Маи на связи",
  plan_sent: "План отправлен — можно уточнить в чате",
  clarifying: "Уточняем детали по плану",
  closed: "Разбор завершён",
  accompaniment_active: "Сопровождение · неделя",
  completed: "Завершено",
};

export const PLAN_INCLUDES = [
  "Разбор дневника по вашей теме (сон или кормление)",
  "Персональный план на 7–14 дней в PDF",
  `${PLAN_CHAT_DAYS} дня в чате — задавайте вопросы и уточняйте, как при сопровождении`,
  "Ответ команды Маи в течение суток после готовности плана",
  "Не врач и не экстренная помощь — поддержка по режиму",
] as const;

export const ACCOMPANIMENT_INCLUDES = [
  "7 дней сопровождения по той же теме",
  "2–3 касания по дневнику",
  "Корректировки плана по ходу",
  "Короткий итог в конце недели",
] as const;
