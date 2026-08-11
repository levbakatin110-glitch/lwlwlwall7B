/** Простой лимит запросов к ИИ по IP (in-memory, на процесс pm2). */

type Bucket = { day: string; count: number };

const buckets = new Map<string, Bucket>();

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
  const cur = buckets.get(key);
  if (!cur || cur.day !== day) {
    buckets.set(key, { day, count: 0 });
  }
  const b = buckets.get(key)!;
  const remaining = Math.max(0, IP_CHAT_LIMIT_PER_DAY - b.count);
  return {
    ok: b.count < IP_CHAT_LIMIT_PER_DAY,
    remaining,
    limit: IP_CHAT_LIMIT_PER_DAY,
  };
}

export function consumeIpChatLimit(ip: string): void {
  const key = (ip || "unknown").slice(0, 64);
  const day = todayUtc();
  const cur = buckets.get(key);
  if (!cur || cur.day !== day) {
    buckets.set(key, { day, count: 1 });
    return;
  }
  cur.count += 1;
}
