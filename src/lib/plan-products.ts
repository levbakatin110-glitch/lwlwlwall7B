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

/** Имя в чате со специалистом (не Мая-бот) */
export const SPECIALIST_DISPLAY_NAME = "Анна · команда Маи";

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

/** Ключи Продамус заданы на сервере */
export function planPaymentsConfigured(): boolean {
  const { secret, payform } = prodamusConfig();
  return Boolean(secret && payform);
}

/**
 * Пока нет кассы — заказы активируются без оплаты (в UI не показываем).
 * Когда заданы PRODAMUS_* — оплата обязательна.
 * PLAN_ORDERS_BYPASS_PAYMENT=false — жёстко требовать кассу даже без ключей.
 */
export function planPaymentsBypass(): boolean {
  if (planPaymentsConfigured()) return false;
  if (process.env.PLAN_ORDERS_BYPASS_PAYMENT === "false") return false;
  return true;
}

export const ORDER_STATUS_MOM: Record<string, string> = {
  paid: "Специалист свяжется с вами в течение дня",
  contacted: "Специалист на связи",
  plan_sent: "План отправлен — можно уточнить",
  clarifying: "Уточнения по плану",
  closed: "Разбор завершён",
  accompaniment_active: "Сопровождение · неделя",
  completed: "Завершено",
};

export const PLAN_INCLUDES = [
  "Разбор дневника по вашей теме",
  "Персональный план на 7–14 дней (PDF)",
  "Переписка со специалистом: вопросы и уточнения",
  "Не врач и не экстренная помощь",
] as const;

export const ACCOMPANIMENT_INCLUDES = [
  "7 дней сопровождения по той же теме",
  "2–3 касания по дневнику",
  "Корректировки плана по ходу",
  "Короткий итог в конце недели",
] as const;
