import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { PaidPlanId, PlanId } from "@/lib/subscription";
import { activatePaidPlan, isSubscriptionActive } from "@/lib/subscription";

export type ServerSubscription = {
  email: string;
  planId: PlanId;
  expiresAt: string | null;
  orderId?: string;
  updatedAt: string;
};

type Store = { byEmail: Record<string, ServerSubscription> };

const DATA_DIR = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "subscriptions.json");

function load(): Store {
  try {
    if (!existsSync(DATA_FILE)) return { byEmail: {} };
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Store;
    if (!raw.byEmail || typeof raw.byEmail !== "object") return { byEmail: {} };
    return raw;
  } catch {
    return { byEmail: {} };
  }
}

function save(store: Store) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch {
    // ignore
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getServerSubscription(
  email: string | null | undefined,
): ServerSubscription | null {
  if (!email?.trim()) return null;
  const row = load().byEmail[normalizeEmail(email)];
  if (!row) return null;
  if (!isSubscriptionActive(row)) return null;
  return row;
}

export function grantPaidPlan(opts: {
  email: string;
  planId: PaidPlanId;
  orderId?: string;
}): ServerSubscription {
  const email = normalizeEmail(opts.email);
  const activated = activatePaidPlan(opts.planId);
  const store = load();
  const row: ServerSubscription = {
    email,
    planId: activated.planId,
    expiresAt: activated.expiresAt,
    orderId: opts.orderId,
    updatedAt: new Date().toISOString(),
  };
  store.byEmail[email] = row;
  save(store);
  return row;
}
