/**
 * Квота чата Premium.
 *
 * DeepSeek (ProxyAPI OpenRouter) при контексте Маи ≈ 0.1–0.25 ₽ / ответ.
 * Пакет по-прежнему ~150 сообщений/мес (продуктовый лимит), API выходит
 * сильно дешевле старого gpt-4.1-mini (~1 ₽).
 */
export const CHAT_COST_PER_MSG_RUB = 0.2;

/** Ориентир по рублёвому бюджету API (для текстов / аналитики) */
export const CHAT_INCLUDED_BUDGET_RUB = 150;

/** Сообщений в базовой квоте месяца */
export const CHAT_INCLUDED_MSGS = 150;

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
