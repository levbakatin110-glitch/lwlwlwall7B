/** Сопровождение консультанта: план + месяц ведения. 790 / 3 дня больше нет. */

import { prodamusConfig } from "@/lib/prodamus";

/**
 * Клиент отключил продажу и чаты консультантов.
 * В продаже только Maya Premium (349 ₽ и пакеты).
 */
export const CONSULTANT_OFFERS_ENABLED = false;

export type PlanTopic = "sleep" | "feed";

export type PlanProductId =
  | "plan_sleep"
  | "plan_feed"
  | "accompany_sleep"
  | "accompany_feed";

export type PlanPaymentKind = "plan" | "accompany";

/** Единственная цена живого продукта */
export const ACCOMPANIMENT_RUB = 1990;
/** @deprecated 790 убран; оставляем алиас, чтобы старые заказы в БД не ломались */
export const PLAN_BREAKDOWN_RUB = ACCOMPANIMENT_RUB;

export const ACCOMPANIMENT_DAYS = 30;
/** Старые заказы «план за 790»: чат 3 дня. Новые 1990 этим не пользуются. */
export const PLAN_CHAT_DAYS = 3;

export const ACCOMPANIMENT_PER_DAY_RUB = Math.round(
  ACCOMPANIMENT_RUB / ACCOMPANIMENT_DAYS,
);

export const PLAN_TEAM_ENTRY_LABEL = "План + месяц";
export const PLAN_TEAM_ENTRY_HINT =
  "Живой консультант в чате · не ИИ и не врач";
export const PLAN_TEAM_FAB_HINT =
  "Живой консультант в чате · не ИИ и не врач";
export const PLAN_TEAM_FAB_LINE1 = "план";
export const PLAN_TEAM_FAB_LINE2 = "человек";
export const PLAN_CONSULTANT_NAMES = "Марина, Юлия и Анна";

export const PLAN_OFFER_TITLE = "Живой человек рядом";
export const PLAN_OFFER_HOOK =
  "Не ещё один ответ от ИИ. Живой консультант разберёт записи, напишет план и месяц будет на связи.";
export const PLAN_OFFER_CTA = "Хочу живого человека";

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

export const FEED_MODULE_IDS = ["breastfeeding", "formula", "solids"] as const;

export const PLAN_PRODUCT_TITLE: Record<PlanProductId, string> = {
  plan_sleep: "Консультант · сон, месяц",
  plan_feed: "Консультант · кормление, месяц",
  accompany_sleep: "Консультант · сон, месяц",
  accompany_feed: "Консультант · кормление, месяц",
};

export function planProductForTopic(topic: PlanTopic): PlanProductId {
  return topic === "sleep" ? "accompany_sleep" : "accompany_feed";
}

export function accompanyProductForTopic(topic: PlanTopic): PlanProductId {
  return topic === "sleep" ? "accompany_sleep" : "accompany_feed";
}

export function priceForProduct(_id: PlanProductId): number {
  return ACCOMPANIMENT_RUB;
}

export function topicFromProduct(id: PlanProductId): PlanTopic {
  return id.includes("feed") ? "feed" : "sleep";
}

export function planOfferHookForTopic(topic: PlanTopic): string {
  if (topic === "sleep") {
    return "По дневнику видно, что ночи даются тяжело. Мая — это ИИ. Здесь подключается живой человек: разберёт записи, напишет план и месяц будет рядом в чате.";
  }
  return "По дневнику кормление пока не выровнялось. Мая — это ИИ. Здесь подключается живой человек: разберёт записи, напишет план и месяц будет рядом в чате.";
}

export function accompanimentPriceLine(): string {
  return `${ACCOMPANIMENT_RUB} ₽ за месяц · ≈ ${ACCOMPANIMENT_PER_DAY_RUB} ₽ в день`;
}

export function planPaymentsConfigured(): boolean {
  const { secret, payform } = prodamusConfig();
  return Boolean(secret && payform);
}

export function planPaymentsLive(): boolean {
  if (process.env.PLAN_PAYMENTS_LIVE !== "true") return false;
  return planPaymentsConfigured();
}

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

/** Что входит в 1990 — один продукт, без «сначала 3 дня» */
export const PLAN_INCLUDES = [
  "Отвечает живой человек — Марина, Юлия или Анна, не бот",
  "Смотрит ваш дневник и пишет план под малыша, не общий чеклист",
  "Месяц в чате: можно писать, когда снова не спите или сами вымотались",
  "Если план не заходит — правим вместе по ходу",
  "Это не врач и не обещание, что малыш сразу начнёт спать",
] as const;

export const ACCOMPANIMENT_INCLUDES = PLAN_INCLUDES;
