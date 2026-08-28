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
      messages_json TEXT NOT NULL DEFAULT '[]',
      diary_snapshot_json TEXT,
      ai_draft_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_plan_orders_email ON plan_orders(email);
    CREATE INDEX IF NOT EXISTS idx_plan_orders_updated ON plan_orders(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_plan_orders_status ON plan_orders(status);
  `);
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

export function getDb(): DatabaseSync {
  const g = globalThis as GlobalDb;
  if (g.__mayaSqlite) return g.__mayaSqlite;

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(dbPath());
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  migrateSchema(db);
  migrateLegacyJson(db);
  g.__mayaSqlite = db;
  return db;
}
