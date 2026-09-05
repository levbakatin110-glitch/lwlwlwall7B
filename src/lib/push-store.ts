import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import webpush from "web-push";
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
const VAPID_FILE = join(DATA_DIR, "vapid.json");
const MAX = 4_000;

type VapidKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

let vapidCache: VapidKeys | null = null;

function subjectFromEnv(): string {
  return (
    process.env.VAPID_SUBJECT?.trim() || "mailto:levprogrammist@gmail.com"
  );
}

function resolveVapid(): VapidKeys | null {
  if (vapidCache) return vapidCache;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (pub && priv) {
    vapidCache = { publicKey: pub, privateKey: priv, subject: subjectFromEnv() };
    return vapidCache;
  }
  try {
    if (existsSync(VAPID_FILE)) {
      const parsed = JSON.parse(readFileSync(VAPID_FILE, "utf8")) as VapidKeys;
      if (parsed.publicKey && parsed.privateKey) {
        vapidCache = {
          publicKey: parsed.publicKey,
          privateKey: parsed.privateKey,
          subject: parsed.subject || subjectFromEnv(),
        };
        return vapidCache;
      }
    }
    const pair = webpush.generateVAPIDKeys();
    const generated: VapidKeys = {
      publicKey: pair.publicKey,
      privateKey: pair.privateKey,
      subject: subjectFromEnv(),
    };
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    try {
      writeFileSync(VAPID_FILE, JSON.stringify(generated), {
        encoding: "utf8",
        flag: "wx",
      });
      vapidCache = generated;
      return vapidCache;
    } catch {
      if (existsSync(VAPID_FILE)) {
        const parsed = JSON.parse(readFileSync(VAPID_FILE, "utf8")) as VapidKeys;
        if (parsed.publicKey && parsed.privateKey) {
          vapidCache = {
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
            subject: parsed.subject || subjectFromEnv(),
          };
          return vapidCache;
        }
      }
      return null;
    }
  } catch {
    return null;
  }
}

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
  return resolveVapid()?.publicKey || "";
}

export function vapidPrivateKey(): string {
  return resolveVapid()?.privateKey || "";
}

export function vapidSubject(): string {
  return resolveVapid()?.subject || subjectFromEnv();
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
