import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { normalizeEmail } from "@/lib/email-codes";

export type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
};

type Row = {
  email: string;
  sub: PushSubscriptionJSON;
  updatedAt: string;
};

type Store = { rows: Row[] };

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "push-subscriptions.json");
const MAX = 4_000;

function load(): Store {
  try {
    if (!existsSync(FILE)) return { rows: [] };
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Store;
    return Array.isArray(parsed.rows) ? parsed : { rows: [] };
  } catch {
    return { rows: [] };
  }
}

function save(store: Store) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(store), "utf8");
}

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY?.trim() || "";
}

export function vapidPrivateKey(): string {
  return process.env.VAPID_PRIVATE_KEY?.trim() || "";
}

export function vapidSubject(): string {
  return (
    process.env.VAPID_SUBJECT?.trim() ||
    "mailto:levprogrammist@gmail.com"
  );
}

export function savePushSubscription(
  email: string,
  sub: PushSubscriptionJSON,
): void {
  if (!sub?.endpoint) return;
  const store = load();
  const e = normalizeEmail(email);
  store.rows = store.rows.filter((r) => r.sub.endpoint !== sub.endpoint);
  store.rows.push({
    email: e,
    sub,
    updatedAt: new Date().toISOString(),
  });
  if (store.rows.length > MAX) store.rows = store.rows.slice(-MAX);
  save(store);
}

export function removePushSubscription(endpoint: string): void {
  const store = load();
  store.rows = store.rows.filter((r) => r.sub.endpoint !== endpoint);
  save(store);
}

export function listPushForEmail(email: string): PushSubscriptionJSON[] {
  const e = normalizeEmail(email);
  return load()
    .rows.filter((r) => r.email === e)
    .map((r) => r.sub);
}
