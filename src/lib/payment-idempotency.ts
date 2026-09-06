import { getDb } from "@/lib/db";

/** true = этот платёж ещё не обрабатывали. */
export function claimPaymentRef(
  paymentRef: string | null | undefined,
  kind: string,
  email: string,
): boolean {
  const ref = paymentRef?.trim();
  if (!ref) return true;
  const db = getDb();
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO processed_payments (payment_ref, kind, email, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(ref, kind, email, new Date().toISOString());
  return Number(result.changes) > 0;
}
