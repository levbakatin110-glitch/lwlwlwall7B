import { getDb } from "@/lib/db";
import { DEFAULT_ANSWER_SEC } from "@/lib/capacity";

const MIN_MS = 800;
const MAX_MS = 120_000;

export function recordChatDurationMs(ms: number) {
  if (!Number.isFinite(ms) || ms < MIN_MS || ms > MAX_MS) return;
  const now = Date.now();
  const db = getDb();
  const prev = db
    .prepare(
      `SELECT ema_ms AS emaMs, samples FROM chat_timing WHERE id = 1`,
    )
    .get() as { emaMs: number; samples: number } | undefined;
  const samples = (prev?.samples ?? 0) + 1;
  const emaMs =
    prev == null ? ms : 0.18 * ms + 0.82 * prev.emaMs;
  db.prepare(
    `INSERT INTO chat_timing (id, ema_ms, samples, updated_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       ema_ms = excluded.ema_ms,
       samples = excluded.samples,
       updated_at = excluded.updated_at`,
  ).run(emaMs, samples, now);
}

export function chatAnswerEstimate(): {
  answerSec: number;
  measured: boolean;
  samples: number;
} {
  try {
    const row = getDb()
      .prepare(`SELECT ema_ms AS emaMs, samples FROM chat_timing WHERE id = 1`)
      .get() as { emaMs: number; samples: number } | undefined;
    if (!row || row.samples < 3) {
      return { answerSec: DEFAULT_ANSWER_SEC, measured: false, samples: 0 };
    }
    return {
      answerSec: Math.round((row.emaMs / 1000) * 10) / 10,
      measured: true,
      samples: row.samples,
    };
  } catch {
    return { answerSec: DEFAULT_ANSWER_SEC, measured: false, samples: 0 };
  }
}
