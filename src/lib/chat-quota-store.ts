import { getDb } from "@/lib/db";
import {
  chatAllowance,
  chatMonthKey,
  type ChatQuotaView,
  CHAT_INCLUDED_BUDGET_RUB,
  CHAT_INCLUDED_MSGS,
  CHAT_TOPUP_MSGS,
  CHAT_TOPUP_RUB,
  CHAT_COST_PER_MSG_RUB,
} from "@/lib/chat-quota";
import { normalizeEmail } from "@/lib/paid-store";
import { recordSale, saleAmountForTopup } from "@/lib/sales-store";

type MonthRow = { used: number; boosts: number };

function quotaKey(email: string) {
  return normalizeEmail(email);
}

function rowFor(key: string, month: string): MonthRow {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT used, boosts FROM chat_quota WHERE quota_key = ? AND month = ?",
    )
    .get(key, month) as { used: number; boosts: number } | undefined;
  return {
    used: Math.max(0, Number(row?.used) || 0),
    boosts: Math.max(0, Number(row?.boosts) || 0),
  };
}

function viewFrom(key: string, month: string, row: MonthRow): ChatQuotaView {
  const allowance = chatAllowance(row.boosts);
  const remaining = Math.max(0, allowance - row.used);
  return {
    month,
    used: row.used,
    boosts: row.boosts,
    allowance,
    remaining,
    includedMsgs: CHAT_INCLUDED_MSGS,
    topupRub: CHAT_TOPUP_RUB,
    topupMsgs: CHAT_TOPUP_MSGS,
    includedBudgetRub: CHAT_INCLUDED_BUDGET_RUB,
    estimatedSpendRub: row.used * CHAT_COST_PER_MSG_RUB,
    needsTopup: remaining <= 0,
  };
}

export function getChatQuotaView(email: string): ChatQuotaView {
  const month = chatMonthKey();
  const key = quotaKey(email);
  return viewFrom(key, month, rowFor(key, month));
}

/** true = можно слать; false = нужна доплата */
export function tryConsumeChatQuota(email: string): {
  ok: boolean;
  view: ChatQuotaView;
} {
  const month = chatMonthKey();
  const key = quotaKey(email);
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = rowFor(key, month);
    const allowance = chatAllowance(row.boosts);
    if (row.used >= allowance) {
      db.exec("COMMIT");
      return { ok: false, view: viewFrom(key, month, row) };
    }
    db.prepare(
      `INSERT INTO chat_quota (quota_key, month, used, boosts) VALUES (?, ?, 1, 0)
       ON CONFLICT(quota_key, month) DO UPDATE SET used = used + 1`,
    ).run(key, month);
    const next = rowFor(key, month);
    db.exec("COMMIT");
    return { ok: true, view: viewFrom(key, month, next) };
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/** Вернуть 1 сообщение (ошибка API до ответа / обрыв без токенов) */
export function refundChatQuota(email: string): ChatQuotaView {
  const month = chatMonthKey();
  const key = quotaKey(email);
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = rowFor(key, month);
    const used = Math.max(0, row.used - 1);
    db.prepare(
      `INSERT INTO chat_quota (quota_key, month, used, boosts) VALUES (?, ?, ?, ?)
       ON CONFLICT(quota_key, month) DO UPDATE SET used = ?`,
    ).run(key, month, used, row.boosts, used);
    const next = rowFor(key, month);
    db.exec("COMMIT");
    return viewFrom(key, month, next);
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export function grantChatTopup(email: string, orderId?: string): ChatQuotaView {
  const month = chatMonthKey();
  const key = quotaKey(email);
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = rowFor(key, month);
    db.prepare(
      `INSERT INTO chat_quota (quota_key, month, used, boosts) VALUES (?, ?, ?, 1)
       ON CONFLICT(quota_key, month) DO UPDATE SET boosts = boosts + 1`,
    ).run(key, month, row.used);
    const next = rowFor(key, month);
    db.exec("COMMIT");
    recordSale({
      email,
      kind: "chat_topup",
      amountRub: saleAmountForTopup(),
      source: orderId?.startsWith("fake-") ? "fake" : "prodamus",
      orderId: orderId || null,
    });
    return viewFrom(key, month, next);
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}
