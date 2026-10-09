/** Лимиты попыток (вход, коды, админка), общие через SQLite для всех воркеров pm2. */

import { getDb } from "@/lib/db";

export type RateLimitResult = { ok: boolean; retryAfterSec: number };

function windowStartFor(now: number, windowSec: number): number {
  return now - (now % windowSec);
}

/** Уже превышен ли лимит (попытку не засчитывает). */
export function rateLimitExceeded(
  key: string,
  limit: number,
  windowSec: number,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const row = getDb()
    .prepare("SELECT count FROM rate_limits WHERE key = ? AND window_start = ?")
    .get(key.slice(0, 200), windowStartFor(now, windowSec)) as
    | { count: number }
    | undefined;
  return (Number(row?.count) || 0) >= limit;
}

/** Засчитывает попытку и говорит, укладываемся ли в limit за windowSec. */
export function hitRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = windowStartFor(now, windowSec);
  const k = key.slice(0, 200);
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1`,
    ).run(k, windowStart);
    const row = db
      .prepare("SELECT count FROM rate_limits WHERE key = ? AND window_start = ?")
      .get(k, windowStart) as { count: number } | undefined;
    if (Math.random() < 0.02) {
      db.prepare("DELETE FROM rate_limits WHERE window_start < ?").run(
        now - 7 * 86_400,
      );
    }
    db.exec("COMMIT");
    const count = Number(row?.count) || 0;
    return {
      ok: count <= limit,
      retryAfterSec: windowStart + windowSec - now,
    };
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/** Проверяет сразу несколько лимитов; все попытки засчитываются. */
export function hitRateLimits(
  rules: { key: string; limit: number; windowSec: number }[],
): RateLimitResult {
  let worst: RateLimitResult = { ok: true, retryAfterSec: 0 };
  for (const r of rules) {
    const res = hitRateLimit(r.key, r.limit, r.windowSec);
    if (!res.ok && (worst.ok || res.retryAfterSec > worst.retryAfterSec)) {
      worst = res;
    }
  }
  return worst;
}

/** IP для лимитов: первый адрес в X-Forwarded-For подделывается клиентом, берём то, что дописал nginx. */
export function requestIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xf = req.headers.get("x-forwarded-for");
  const last = xf?.split(",").pop()?.trim();
  return last || "unknown";
}

export function tooManyRequests(res: RateLimitResult): Response {
  const minutes = Math.max(1, Math.ceil(res.retryAfterSec / 60));
  return Response.json(
    { error: `Слишком много попыток. Попробуйте через ${minutes} мин.` },
    { status: 429, headers: { "Retry-After": String(res.retryAfterSec) } },
  );
}
