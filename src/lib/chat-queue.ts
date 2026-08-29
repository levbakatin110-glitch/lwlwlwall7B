/**
 * Общая очередь чата через SQLite — работает между несколькими процессами pm2.
 * Слоты с TTL: если воркер умер, через ~3 мин слот освободится сам.
 */

import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";

export const CHAT_MAX_CONCURRENT = Math.max(
  1,
  Number(process.env.CHAT_MAX_CONCURRENT) || 50,
);

export const CHAT_MAX_WAITING = Math.max(
  0,
  Number(process.env.CHAT_MAX_WAITING) || 120,
);

export const CHAT_QUEUE_WAIT_MS = Math.max(
  5_000,
  Number(process.env.CHAT_QUEUE_WAIT_MS) || 40_000,
);

/** Макс. жизнь слота без release (защита от зависших стримов) */
const LEASE_TTL_MS = Math.max(
  60_000,
  Number(process.env.CHAT_LEASE_TTL_MS) || 180_000,
);

const POLL_MS = 180;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function newId() {
  return `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;
}

function cleanup(db: ReturnType<typeof getDb>, now = Date.now()) {
  db.prepare("DELETE FROM chat_leases WHERE expires_at < ?").run(now);
  db.prepare("DELETE FROM chat_waiters WHERE created_at < ?").run(
    now - CHAT_QUEUE_WAIT_MS - 10_000,
  );
}

export function chatQueueSnapshot() {
  const db = getDb();
  const now = Date.now();
  cleanup(db, now);
  const active = (
    db.prepare("SELECT COUNT(*) AS c FROM chat_leases").get() as { c: number }
  ).c;
  const waiting = (
    db.prepare("SELECT COUNT(*) AS c FROM chat_waiters").get() as { c: number }
  ).c;
  return {
    active,
    waiting,
    maxConcurrent: CHAT_MAX_CONCURRENT,
    maxWaiting: CHAT_MAX_WAITING,
  };
}

function tryInsertLease(id: string): boolean {
  const db = getDb();
  const now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    cleanup(db, now);
    const active = (
      db.prepare("SELECT COUNT(*) AS c FROM chat_leases").get() as { c: number }
    ).c;
    if (active >= CHAT_MAX_CONCURRENT) {
      db.exec("COMMIT");
      return false;
    }
    db.prepare(
      "INSERT INTO chat_leases (id, acquired_at, expires_at) VALUES (?, ?, ?)",
    ).run(id, now, now + LEASE_TTL_MS);
    db.exec("COMMIT");
    return true;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

function tryRegisterWaiter(id: string): boolean {
  const db = getDb();
  const now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    cleanup(db, now);
    const waiting = (
      db.prepare("SELECT COUNT(*) AS c FROM chat_waiters").get() as {
        c: number;
      }
    ).c;
    if (waiting >= CHAT_MAX_WAITING) {
      db.exec("COMMIT");
      return false;
    }
    db.prepare("INSERT INTO chat_waiters (id, created_at) VALUES (?, ?)").run(
      id,
      now,
    );
    db.exec("COMMIT");
    return true;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

function dropWaiter(id: string) {
  try {
    getDb().prepare("DELETE FROM chat_waiters WHERE id = ?").run(id);
  } catch {
    /* ignore */
  }
}

function dropLease(id: string) {
  try {
    getDb().prepare("DELETE FROM chat_leases WHERE id = ?").run(id);
  } catch {
    /* ignore */
  }
}

/** Продлить TTL, пока стрим жив */
export function touchChatLease(leaseId: string) {
  const now = Date.now();
  try {
    getDb()
      .prepare("UPDATE chat_leases SET expires_at = ? WHERE id = ?")
      .run(now + LEASE_TTL_MS, leaseId);
  } catch {
    /* ignore */
  }
}

export type ChatSlotLease = {
  id: string;
  release: () => void;
  touch: () => void;
  waitedMs: number;
  fromQueue: boolean;
};

export type AcquireChatSlotResult =
  | { ok: true; lease: ChatSlotLease }
  | {
      ok: false;
      reason: "queue_full" | "wait_timeout";
      snapshot: ReturnType<typeof chatQueueSnapshot>;
    };

function makeLease(
  id: string,
  waitedMs: number,
  fromQueue: boolean,
): ChatSlotLease {
  let released = false;
  return {
    id,
    waitedMs,
    fromQueue,
    touch: () => touchChatLease(id),
    release: () => {
      if (released) return;
      released = true;
      dropLease(id);
    },
  };
}

export async function acquireChatSlot(
  waitMs = CHAT_QUEUE_WAIT_MS,
): Promise<AcquireChatSlotResult> {
  const leaseId = newId();
  if (tryInsertLease(leaseId)) {
    return { ok: true, lease: makeLease(leaseId, 0, false) };
  }

  const waiterId = newId();
  if (!tryRegisterWaiter(waiterId)) {
    return {
      ok: false,
      reason: "queue_full",
      snapshot: chatQueueSnapshot(),
    };
  }

  const started = Date.now();
  const deadline = started + waitMs;
  try {
    while (Date.now() < deadline) {
      await sleep(POLL_MS);
      if (tryInsertLease(leaseId)) {
        dropWaiter(waiterId);
        return {
          ok: true,
          lease: makeLease(leaseId, Date.now() - started, true),
        };
      }
    }
  } finally {
    dropWaiter(waiterId);
  }

  return {
    ok: false,
    reason: "wait_timeout",
    snapshot: chatQueueSnapshot(),
  };
}

export function chatBusyMessage(reason: "queue_full" | "wait_timeout") {
  if (reason === "queue_full") {
    return "Сейчас очень много мам пишет Мае одновременно. Подождите около минуты и попробуйте снова.";
  }
  return "Мая чуть занята — очередь подождать не успела. Нажмите отправить ещё раз через несколько секунд.";
}
