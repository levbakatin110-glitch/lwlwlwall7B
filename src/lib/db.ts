import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, renameSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const DEFAULT_DB = join(DATA_DIR, "maya.db");
const LEGACY_JSON = join(DATA_DIR, "plan-orders.json");

type GlobalDb = typeof globalThis & { __mayaSqlite?: DatabaseSync };

function dbPath(): string {
  return process.env.DATABASE_PATH?.trim() || DEFAULT_DB;
}

function migrateSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plan_orders (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      email TEXT NOT NULL,
      child_id TEXT,
      child_name TEXT,
      topic TEXT NOT NULL,
      product_id TEXT NOT NULL,
      status TEXT NOT NULL,
      price_rub INTEGER NOT NULL,
      paid_at TEXT,
      payment_ref TEXT,
      accompaniment_paid INTEGER NOT NULL DEFAULT 0,
      accompaniment_pending INTEGER NOT NULL DEFAULT 0,
      accompaniment_price_rub INTEGER,
      chat_closed_at TEXT,
      plan_sent_at TEXT,
      chat_deadline_at TEXT,
      accompaniment_deadline_at TEXT,
      consultant_id TEXT NOT NULL DEFAULT 'marina',
      messages_json TEXT NOT NULL DEFAULT '[]',
      diary_snapshot_json TEXT,
      ai_draft_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_plan_orders_email ON plan_orders(email);
    CREATE INDEX IF NOT EXISTS idx_plan_orders_updated ON plan_orders(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_plan_orders_status ON plan_orders(status);

    CREATE TABLE IF NOT EXISTS chat_quota (
      quota_key TEXT NOT NULL,
      month TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      boosts INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (quota_key, month)
    );

    CREATE TABLE IF NOT EXISTS chat_leases (
      id TEXT PRIMARY KEY,
      acquired_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_leases_exp ON chat_leases(expires_at);

    CREATE TABLE IF NOT EXISTS chat_waiters (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      at TEXT NOT NULL,
      name TEXT NOT NULL,
      day TEXT NOT NULL,
      visitor_id TEXT,
      meta TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_day ON analytics_events(day);
    CREATE INDEX IF NOT EXISTS idx_analytics_at ON analytics_events(at DESC);

    CREATE TABLE IF NOT EXISTS ip_chat_limits (
      ip TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ip, day)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      email TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      expires_at TEXT,
      order_id TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_schedule (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      url TEXT NOT NULL,
      tag TEXT NOT NULL,
      next_at INTEGER NOT NULL,
      mode TEXT NOT NULL,
      interval_min INTEGER,
      times_json TEXT,
      quiet_from TEXT,
      quiet_to TEXT,
      tz_offset_min INTEGER NOT NULL DEFAULT 0,
      last_sent_at INTEGER,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_push_schedule_email ON push_schedule(email);
    CREATE INDEX IF NOT EXISTS idx_push_schedule_next ON push_schedule(next_at);

    CREATE TABLE IF NOT EXISTS presence_heartbeats (
      visitor_id TEXT PRIMARY KEY,
      last_seen INTEGER NOT NULL,
      screen TEXT NOT NULL DEFAULT '',
      path TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_presence_seen ON presence_heartbeats(last_seen);

    CREATE TABLE IF NOT EXISTS live_peaks (
      day TEXT PRIMARY KEY,
      peak_online INTEGER NOT NULL DEFAULT 0,
      peak_chat INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
  `);
  const cols = db.prepare("PRAGMA table_info(plan_orders)").all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === "consultant_id")) {
    db.exec(
      "ALTER TABLE plan_orders ADD COLUMN consultant_id TEXT NOT NULL DEFAULT 'marina'",
    );
  }
}

function migrateLegacyJson(db: DatabaseSync) {
  const count = (
    db.prepare("SELECT COUNT(*) AS c FROM plan_orders").get() as { c: number }
  ).c;
  if (count > 0 || !existsSync(LEGACY_JSON)) return;

  try {
    const raw = readFileSync(LEGACY_JSON, "utf8");
    const parsed = JSON.parse(raw) as {
      orders?: Array<Record<string, unknown>>;
    };
    const orders = parsed.orders ?? [];
    if (!orders.length) return;

    const insert = db.prepare(`
      INSERT INTO plan_orders (
        id, created_at, updated_at, email, child_id, child_name, topic, product_id,
        status, price_rub, paid_at, payment_ref, accompaniment_paid, accompaniment_pending,
        accompaniment_price_rub, chat_closed_at, plan_sent_at, chat_deadline_at,
        accompaniment_deadline_at, messages_json, diary_snapshot_json, ai_draft_json
      ) VALUES (
        @id, @created_at, @updated_at, @email, @child_id, @child_name, @topic, @product_id,
        @status, @price_rub, @paid_at, @payment_ref, @accompaniment_paid, @accompaniment_pending,
        @accompaniment_price_rub, @chat_closed_at, @plan_sent_at, @chat_deadline_at,
        @accompaniment_deadline_at, @messages_json, @diary_snapshot_json, @ai_draft_json
      )
    `);

    db.exec("BEGIN IMMEDIATE");
    try {
      for (const o of orders) {
        insert.run({
          id: o.id,
          created_at: o.createdAt,
          updated_at: o.updatedAt,
          email: o.email,
          child_id: o.childId ?? null,
          child_name: o.childName ?? null,
          topic: o.topic,
          product_id: o.productId,
          status: o.status,
          price_rub: o.priceRub,
          paid_at: o.paidAt ?? null,
          payment_ref: o.paymentRef ?? null,
          accompaniment_paid: o.accompanimentPaid ? 1 : 0,
          accompaniment_pending: o.accompanimentPending ? 1 : 0,
          accompaniment_price_rub: o.accompanimentPriceRub ?? null,
          chat_closed_at: o.chatClosedAt ?? null,
          plan_sent_at: o.planSentAt ?? null,
          chat_deadline_at: o.chatDeadlineAt ?? null,
          accompaniment_deadline_at: o.accompanimentDeadlineAt ?? null,
          messages_json: JSON.stringify(o.messages ?? []),
          diary_snapshot_json: o.diarySnapshot
            ? JSON.stringify(o.diarySnapshot)
            : null,
          ai_draft_json: o.aiDraft ? JSON.stringify(o.aiDraft) : null,
        } as Record<string, string | number | null>);
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }

    renameSync(LEGACY_JSON, `${LEGACY_JSON}.migrated`);
    console.info(`[db] migrated ${orders.length} plan orders from JSON`);
  } catch (e) {
    console.error("[db] legacy JSON migration failed", e);
  }
}

function migrateJsonSidecars(db: DatabaseSync) {
  const quotaFile = join(DATA_DIR, "chat-quota.json");
  const quotaCount = (
    db.prepare("SELECT COUNT(*) AS c FROM chat_quota").get() as { c: number }
  ).c;
  if (quotaCount === 0 && existsSync(quotaFile)) {
    try {
      const raw = JSON.parse(readFileSync(quotaFile, "utf8")) as {
        byEmail?: Record<string, Record<string, { used?: number; boosts?: number }>>;
      };
      const insert = db.prepare(
        `INSERT OR IGNORE INTO chat_quota (quota_key, month, used, boosts) VALUES (?, ?, ?, ?)`,
      );
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const [key, months] of Object.entries(raw.byEmail ?? {})) {
          for (const [month, row] of Object.entries(months ?? {})) {
            insert.run(
              key,
              month,
              Math.max(0, Number(row?.used) || 0),
              Math.max(0, Number(row?.boosts) || 0),
            );
          }
        }
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      renameSync(quotaFile, `${quotaFile}.migrated`);
      console.info("[db] migrated chat-quota.json → sqlite");
    } catch (e) {
      console.error("[db] chat-quota migration failed", e);
    }
  }

  const analyticsFile = join(DATA_DIR, "analytics.json");
  const analyticsCount = (
    db.prepare("SELECT COUNT(*) AS c FROM analytics_events").get() as {
      c: number;
    }
  ).c;
  if (analyticsCount === 0 && existsSync(analyticsFile)) {
    try {
      const raw = JSON.parse(readFileSync(analyticsFile, "utf8")) as {
        events?: Array<{
          id?: string;
          at?: string;
          name?: string;
          day?: string;
          visitorId?: string;
          meta?: string;
        }>;
      };
      const insert = db.prepare(
        `INSERT OR IGNORE INTO analytics_events (id, at, name, day, visitor_id, meta) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const e of raw.events ?? []) {
          if (!e?.id || !e.at || !e.name || !e.day) continue;
          insert.run(
            e.id,
            e.at,
            e.name,
            e.day,
            e.visitorId ?? null,
            e.meta ?? null,
          );
        }
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
      renameSync(analyticsFile, `${analyticsFile}.migrated`);
      console.info("[db] migrated analytics.json → sqlite");
    } catch (e) {
      console.error("[db] analytics migration failed", e);
    }
  }

  const subsFile = join(DATA_DIR, "subscriptions.json");
  const subsCount = (
    db.prepare("SELECT COUNT(*) AS c FROM subscriptions").get() as { c: number }
  ).c;
  if (subsCount === 0 && existsSync(subsFile)) {
    try {
      const raw = JSON.parse(readFileSync(subsFile, "utf8")) as {
        byEmail?: Record<
          string,
          {
            email?: string;
            planId?: string;
            expiresAt?: string | null;
            orderId?: string;
            updatedAt?: string;
          }
        >;
      };
      const insert = db.prepare(
        `INSERT OR IGNORE INTO subscriptions (email, plan_id, expires_at, order_id, updated_at) VALUES (?, ?, ?, ?, ?)`,
      );
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const [email, row] of Object.entries(raw.byEmail ?? {})) {
          insert.run(
            email,
            row.planId || "free",
            row.expiresAt ?? null,
            row.orderId ?? null,
            row.updatedAt || new Date().toISOString(),
          );
        }
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      renameSync(subsFile, `${subsFile}.migrated`);
      console.info("[db] migrated subscriptions.json → sqlite");
    } catch (e) {
      console.error("[db] subscriptions migration failed", e);
    }
  }
}

export function getDb(): DatabaseSync {
  const g = globalThis as GlobalDb;
  if (g.__mayaSqlite) return g.__mayaSqlite;

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(dbPath());
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 8000");
  db.exec("PRAGMA synchronous = NORMAL");
  migrateSchema(db);
  migrateLegacyJson(db);
  migrateJsonSidecars(db);
  g.__mayaSqlite = db;
  return db;
}
