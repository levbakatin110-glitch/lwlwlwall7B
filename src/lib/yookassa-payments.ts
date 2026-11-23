import { CHAT_TOPUP_RUB } from "@/lib/chat-quota";
import { grantChatTopup } from "@/lib/chat-quota-store";
import { getDb } from "@/lib/db";
import { grantPaidPlan, normalizeEmail } from "@/lib/paid-store";
import { planById, type PaidPlanId } from "@/lib/subscription";
import {
  amountToKopeks,
  yookassaGetPayment,
  type YookassaPayment,
} from "@/lib/yookassa";

export type YookassaKind = "subscription" | "chat_boost";

export function rememberYookassaPayment(opts: {
  paymentId: string;
  email: string;
  kind: YookassaKind;
  planId: PaidPlanId | null;
  amountRub: number;
}) {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO yookassa_payments
        (payment_id, email, kind, plan_id, amount_rub, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .run(
      opts.paymentId,
      normalizeEmail(opts.email),
      opts.kind,
      opts.planId,
      opts.amountRub,
      new Date().toISOString(),
    );
}

type StoredPayment = {
  paymentId: string;
  email: string;
  kind: YookassaKind;
  planId: PaidPlanId | null;
  amountRub: number;
  status: string;
};

function readStored(paymentId: string): StoredPayment | null {
  const row = getDb()
    .prepare(
      `SELECT payment_id AS paymentId, email, kind, plan_id AS planId,
              amount_rub AS amountRub, status
       FROM yookassa_payments WHERE payment_id = ?`,
    )
    .get(paymentId) as StoredPayment | undefined;
  return row ?? null;
}

function markStatus(paymentId: string, status: string) {
  getDb()
    .prepare(`UPDATE yookassa_payments SET status = ? WHERE payment_id = ?`)
    .run(status, paymentId);
}

/** Выдать доступ только если ЮKassa подтвердила эту сумму. */
export async function fulfillYookassaPayment(
  paymentId: string,
): Promise<"granted" | "pending" | "ignored"> {
  const stored = readStored(paymentId);
  if (!stored) return "ignored";
  if (stored.status === "succeeded") return "granted";

  const remote = await yookassaGetPayment(paymentId);
  if (!remote) return "pending";
  if (remote.status === "canceled") {
    markStatus(paymentId, "canceled");
    return "ignored";
  }
  if (remote.status !== "succeeded" || remote.paid !== true) return "pending";
  if (!amountMatches(remote, stored.amountRub)) {
    markStatus(paymentId, "amount_mismatch");
    return "ignored";
  }
  const metaEmail = remote.metadata?.email?.trim().toLowerCase() || "";
  if (metaEmail && metaEmail !== stored.email) {
    markStatus(paymentId, "email_mismatch");
    return "ignored";
  }

  if (stored.kind === "chat_boost") {
    if (stored.amountRub !== CHAT_TOPUP_RUB) return "ignored";
    grantChatTopup(stored.email, paymentId, "yookassa");
  } else if (stored.planId) {
    const plan = planById(stored.planId);
    if (!plan || plan.priceRub !== stored.amountRub) return "ignored";
    grantPaidPlan({
      email: stored.email,
      planId: stored.planId,
      orderId: paymentId,
      source: "yookassa",
    });
  } else {
    return "ignored";
  }
  markStatus(paymentId, "succeeded");
  return "granted";
}

function amountMatches(remote: YookassaPayment, expectedRub: number): boolean {
  if (remote.amount?.currency !== "RUB") return false;
  const paid = amountToKopeks(remote.amount.value);
  return paid != null && paid === Math.round(expectedRub * 100);
}

export async function syncYookassaForEmail(email: string): Promise<boolean> {
  const key = normalizeEmail(email);
  const rows = getDb()
    .prepare(
      `SELECT payment_id AS paymentId FROM yookassa_payments
       WHERE email = ? AND status = 'pending'
       ORDER BY created_at DESC LIMIT 5`,
    )
    .all(key) as { paymentId: string }[];
  let granted = false;
  for (const row of rows) {
    const result = await fulfillYookassaPayment(row.paymentId);
    if (result === "granted") granted = true;
  }
  return granted;
}
