/**
 * Квота чата Premium: в подписку заложено ~150 ₽ на ProxyAPI.
 *
 * Оценка gpt-4.1-mini через ProxyAPI при контексте Маи:
 * ~0.8–1.2 ₽ / ответ → считаем 1 ₽ ≈ 1 сообщение.
 */
export const CHAT_COST_PER_MSG_RUB = 1;

/** Сколько рублей API заложено в Premium на календарный месяц */
export const CHAT_INCLUDED_BUDGET_RUB = 150;

/** Сообщений в базовой квоте месяца (= бюджет / цена ответа) */
export const CHAT_INCLUDED_MSGS =
  Math.round(CHAT_INCLUDED_BUDGET_RUB / CHAT_COST_PER_MSG_RUB) || 150;

/** Доплата, когда базовый пакет исчерпан */
export const CHAT_TOPUP_RUB = 99;

/** Сколько сообщений даёт одна доплата (тот же объём, что в базе) */
export const CHAT_TOPUP_MSGS = CHAT_INCLUDED_MSGS;

export function chatMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function chatAllowance(boosts: number): number {
  const b = Math.max(0, Math.floor(boosts));
  return CHAT_INCLUDED_MSGS + b * CHAT_TOPUP_MSGS;
}

export type ChatQuotaView = {
  month: string;
  used: number;
  boosts: number;
  allowance: number;
  remaining: number;
  includedMsgs: number;
  topupRub: number;
  topupMsgs: number;
  includedBudgetRub: number;
  estimatedSpendRub: number;
  needsTopup: boolean;
};
