import { getDb } from "@/lib/db";
import { claimPaymentRef } from "@/lib/payment-idempotency";
import { recordSale, saleAmountForPlan } from "@/lib/sales-store";
import type { PaidPlanId, PlanId } from "@/lib/subscription";
import {
  activatePaidPlanExtending,
  isSubscriptionActive,
} from "@/lib/subscription";

export type ServerSubscription = {
  email: string;
  planId: PlanId;
  expiresAt: string | null;
  orderId?: string;
  updatedAt: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getServerSubscription(
  email: string | null | undefined,
): ServerSubscription | null {
  if (!email?.trim()) return null;
  const key = normalizeEmail(email);
  const raw = getDb()
    .prepare(
      `SELECT email, plan_id AS planId, expires_at AS expiresAt,
              order_id AS orderId, updated_at AS updatedAt
       FROM subscriptions WHERE email = ?`,
    )
    .get(key) as
    | {
        email: string;
        planId: PlanId;
        expiresAt: string | null;
        orderId: string | null;
        updatedAt: string;
      }
    | undefined;
  if (!raw) return null;
  const row: ServerSubscription = {
    email: raw.email,
    planId: raw.planId,
    expiresAt: raw.expiresAt,
    orderId: raw.orderId ?? undefined,
    updatedAt: raw.updatedAt,
  };
  if (!isSubscriptionActive(row)) return null;
  return row;
}

function readSubscriptionRow(email: string): ServerSubscription | null {
  const raw = getDb()
    .prepare(
      `SELECT email, plan_id AS planId, expires_at AS expiresAt,
              order_id AS orderId, updated_at AS updatedAt
       FROM subscriptions WHERE email = ?`,
    )
    .get(email) as
    | {
        email: string;
        planId: PlanId;
        expiresAt: string | null;
        orderId: string | null;
        updatedAt: string;
      }
    | undefined;
  if (!raw) return null;
  return {
    email: raw.email,
    planId: raw.planId,
    expiresAt: raw.expiresAt,
    orderId: raw.orderId ?? undefined,
    updatedAt: raw.updatedAt,
  };
}

export function grantPaidPlan(opts: {
  email: string;
  planId: PaidPlanId;
  orderId?: string;
  source?: "prodamus" | "fake";
}): ServerSubscription {
  const email = normalizeEmail(opts.email);
  const existing = readSubscriptionRow(email);
  if (opts.orderId && !claimPaymentRef(opts.orderId, "subscription", email)) {
    if (existing) return existing;
    return {
      email,
      planId: opts.planId,
      expiresAt: null,
      orderId: opts.orderId,
      updatedAt: new Date().toISOString(),
    };
  }

  const activated = activatePaidPlanExtending(opts.planId, existing?.expiresAt);
  const row: ServerSubscription = {
    email,
    planId: activated.planId,
    expiresAt: activated.expiresAt,
    orderId: opts.orderId,
    updatedAt: new Date().toISOString(),
  };
  getDb()
    .prepare(
      `INSERT INTO subscriptions (email, plan_id, expires_at, order_id, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         plan_id = excluded.plan_id,
         expires_at = excluded.expires_at,
         order_id = excluded.order_id,
         updated_at = excluded.updated_at`,
    )
    .run(
      row.email,
      row.planId,
      row.expiresAt,
      row.orderId ?? null,
      row.updatedAt,
    );
  recordSale({
    email,
    kind: "subscription",
    planId: opts.planId,
    amountRub: saleAmountForPlan(opts.planId),
    source:
      opts.source ??
      (opts.orderId?.startsWith("fake-") ? "fake" : "prodamus"),
    orderId: opts.orderId,
  });
  return row;
}
