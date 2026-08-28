/** Персональный план + разбор и сопровождение */

export type PlanTopic = "sleep" | "feed";

export type PlanProductId =
  | "plan_sleep"
  | "plan_feed"
  | "accompany_sleep"
  | "accompany_feed";

export const PLAN_BREAKDOWN_RUB = 1490;
export const ACCOMPANIMENT_RUB = 1990;

/** Имя в чате со специалистом (не Мая-бот) */
export const SPECIALIST_DISPLAY_NAME = "Анна · команда Маи";

/** Пока нет ключей Продамус — заказ сразу «оплачен» для теста воронки */
export const PLAN_ORDERS_SKIP_PAYMENT = true;

export const PLAN_TOPIC_LABEL: Record<PlanTopic, string> = {
  sleep: "сон",
  feed: "кормление",
};

export const PLAN_TOPIC_MODULE: Record<PlanTopic, string> = {
  sleep: "sleep",
  feed: "breastfeeding",
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
