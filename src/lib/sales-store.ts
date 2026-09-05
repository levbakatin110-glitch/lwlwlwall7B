import { getDb } from "@/lib/db";
import { CHAT_TOPUP_RUB } from "@/lib/chat-quota";
import { isSubscriptionActive, planById, type PaidPlanId } from "@/lib/subscription";

export type SaleKind = "subscription" | "chat_topup";
export type SaleSource = "prodamus" | "fake";

export type SaleRow = {
  id: string;
  at: string;
  email: string;
  kind: SaleKind;
  planId: string | null;
  amountRub: number;
  source: SaleSource;
  orderId: string | null;
};

export type SalesBucket = {
  count: number;
  amountRub: number;
};

export type SalesReport = {
  today: SalesBucket;
  week: SalesBucket;
  month: SalesBucket;
  all: SalesBucket;
  byPlan: { planId: string; label: string; count: number; amountRub: number }[];
  activeSubs: number;
  fakeCount: number;
  recent: SaleRow[];
};

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyBucket(): SalesBucket {
  return { count: 0, amountRub: 0 };
}

function addTo(bucket: SalesBucket, amount: number) {
  bucket.count += 1;
  bucket.amountRub += amount;
}

export function recordSale(input: {
  email: string;
  kind: SaleKind;
  planId?: string | null;
  amountRub: number;
  source: SaleSource;
  orderId?: string | null;
  at?: string;
}): SaleRow | null {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  const amountRub = Math.max(0, Math.round(input.amountRub));
  const at = input.at || new Date().toISOString();
  const orderId = input.orderId?.trim() || null;
  const db = getDb();
  if (orderId) {
    const exists = db
      .prepare("SELECT id FROM sales WHERE order_id = ?")
      .get(orderId) as { id: string } | undefined;
    if (exists) return null;
  }
  const row: SaleRow = {
    id: uid(input.kind === "chat_topup" ? "top" : "sub"),
    at,
    email,
    kind: input.kind,
    planId: input.planId ?? null,
    amountRub,
    source: input.source,
    orderId,
  };
  db.prepare(
    `INSERT INTO sales (id, at, email, kind, plan_id, amount_rub, source, order_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.at,
    row.email,
    row.kind,
    row.planId,
    row.amountRub,
    row.source,
    row.orderId,
  );
  return row;
}

function backfillFromSubscriptions() {
  const db = getDb();
  const subs = db
    .prepare(
      `SELECT email, plan_id AS planId, order_id AS orderId, updated_at AS updatedAt
       FROM subscriptions`,
    )
    .all() as {
    email: string;
    planId: string;
    orderId: string | null;
    updatedAt: string;
  }[];
  for (const s of subs) {
    if (!s.planId || s.planId === "free") continue;
    const plan = planById(s.planId as PaidPlanId);
    if (!plan) continue;
    recordSale({
      email: s.email,
      kind: "subscription",
      planId: s.planId,
      amountRub: plan.priceRub,
      source: s.orderId?.startsWith("fake-") ? "fake" : "prodamus",
      orderId: s.orderId || `legacy-${s.email}`,
      at: s.updatedAt,
    });
  }
}

export function getSalesReport(now = Date.now()): SalesReport {
  backfillFromSubscriptions();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, at, email, kind, plan_id AS planId, amount_rub AS amountRub,
              source, order_id AS orderId
       FROM sales ORDER BY at DESC LIMIT 400`,
    )
    .all() as {
    id: string;
    at: string;
    email: string;
    kind: SaleKind;
    planId: string | null;
    amountRub: number;
    source: SaleSource;
    orderId: string | null;
  }[];

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const today = emptyBucket();
  const week = emptyBucket();
  const month = emptyBucket();
  const all = emptyBucket();
  const byPlanMap = new Map<string, { count: number; amountRub: number }>();
  let fakeCount = 0;

  for (const r of rows) {
    const t = Date.parse(r.at);
    addTo(all, r.amountRub);
    if (Number.isFinite(t)) {
      if (t >= todayStart.getTime()) addTo(today, r.amountRub);
      if (t >= weekAgo) addTo(week, r.amountRub);
      if (t >= monthAgo) addTo(month, r.amountRub);
    }
    if (r.source === "fake") fakeCount += 1;
    if (r.kind === "subscription" && r.planId) {
      const cur = byPlanMap.get(r.planId) ?? { count: 0, amountRub: 0 };
      cur.count += 1;
      cur.amountRub += r.amountRub;
      byPlanMap.set(r.planId, cur);
    }
  }

  const byPlan = ["m1", "m3", "m6"].map((planId) => {
    const cur = byPlanMap.get(planId) ?? { count: 0, amountRub: 0 };
    return {
      planId,
      label: planById(planId as PaidPlanId)?.label ?? planId,
      count: cur.count,
      amountRub: cur.amountRub,
    };
  });

  const subs = db
    .prepare(
      `SELECT email, plan_id AS planId, expires_at AS expiresAt
       FROM subscriptions`,
    )
    .all() as { email: string; planId: string; expiresAt: string | null }[];
  const activeSubs = subs.filter((s) =>
    isSubscriptionActive({
      planId: s.planId as PaidPlanId,
      expiresAt: s.expiresAt,
    }),
  ).length;

  return {
    today,
    week,
    month,
    all,
    byPlan,
    activeSubs,
    fakeCount,
    recent: rows.slice(0, 40),
  };
}

export function saleAmountForPlan(planId: PaidPlanId): number {
  return planById(planId)?.priceRub ?? 0;
}

export function saleAmountForTopup(): number {
  return CHAT_TOPUP_RUB;
}
