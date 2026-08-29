/** Лимит бесплатных запросов к ИИ по IP — общий через SQLite (все воркеры pm2). */

import { getDb } from "@/lib/db";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Сколько ИИ-запросов с одного IP в сутки (даже если чистят localStorage) */
export const IP_CHAT_LIMIT_PER_DAY = 3;

export function checkIpChatLimit(ip: string): {
  ok: boolean;
  remaining: number;
  limit: number;
} {
  const key = (ip || "unknown").slice(0, 64);
  const day = todayUtc();
  const row = getDb()
    .prepare("SELECT count FROM ip_chat_limits WHERE ip = ? AND day = ?")
    .get(key, day) as { count: number } | undefined;
  const count = Math.max(0, Number(row?.count) || 0);
  const remaining = Math.max(0, IP_CHAT_LIMIT_PER_DAY - count);
  return {
    ok: count < IP_CHAT_LIMIT_PER_DAY,
    remaining,
    limit: IP_CHAT_LIMIT_PER_DAY,
  };
}

export function consumeIpChatLimit(ip: string): void {
  const key = (ip || "unknown").slice(0, 64);
  const day = todayUtc();
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO ip_chat_limits (ip, day, count) VALUES (?, ?, 1)
       ON CONFLICT(ip, day) DO UPDATE SET count = count + 1`,
    ).run(key, day);
    db.exec("COMMIT");
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}
