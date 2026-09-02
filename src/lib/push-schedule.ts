import { getDb } from "@/lib/db";
import { normalizeEmail } from "@/lib/email-codes";
import {
  advanceAfterFire,
  type CareReminderMode,
  type ScheduledPushItem,
} from "@/lib/care-reminders";

export type ScheduleRow = ScheduledPushItem & {
  email: string;
  lastSentAt: number | null;
};

function parseTimes(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return undefined;
    return v.map(String).slice(0, 8);
  } catch {
    return undefined;
  }
}

function rowFromDb(r: Record<string, unknown>): ScheduleRow {
  return {
    id: String(r.id),
    email: String(r.email),
    title: String(r.title),
    body: String(r.body),
    url: String(r.url),
    tag: String(r.tag),
    nextAt: Number(r.next_at),
    mode: r.mode as CareReminderMode | "once",
    intervalMin: r.interval_min == null ? undefined : Number(r.interval_min),
    times: parseTimes(r.times_json as string | null),
    quietFrom: (r.quiet_from as string | null) || undefined,
    quietTo: (r.quiet_to as string | null) || undefined,
    tzOffsetMin: Number(r.tz_offset_min) || 0,
    lastSentAt: r.last_sent_at == null ? null : Number(r.last_sent_at),
  };
}

export function replaceScheduleForEmail(
  email: string,
  items: ScheduledPushItem[],
): void {
  const e = normalizeEmail(email);
  const db = getDb();
  const del = db.prepare("DELETE FROM push_schedule WHERE email = ?");
  const ins = db.prepare(
    `INSERT INTO push_schedule (
      id, email, title, body, url, tag, next_at, mode, interval_min,
      times_json, quiet_from, quiet_to, tz_offset_min, last_sent_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    del.run(e);
    const now = Date.now();
    for (const it of items.slice(0, 60)) {
      if (!it.id || !it.nextAt || !Number.isFinite(it.nextAt)) continue;
      ins.run(
        it.id.slice(0, 120),
        e,
        it.title.slice(0, 80),
        it.body.slice(0, 220),
        (it.url || "/").slice(0, 160),
        (it.tag || it.id).slice(0, 120),
        Math.round(it.nextAt),
        it.mode,
        it.intervalMin ?? null,
        it.times ? JSON.stringify(it.times) : null,
        it.quietFrom ?? null,
        it.quietTo ?? null,
        Math.round(it.tzOffsetMin || 0),
        now,
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** Забирает просроченные слоты и сразу двигает next_at — чтобы два воркера не слали дважды. */
export function claimDuePushes(now = Date.now(), limit = 80): ScheduleRow[] {
  const db = getDb();
  const claimed: ScheduleRow[] = [];
  db.exec("BEGIN IMMEDIATE");
  try {
    const rows = db
      .prepare(
        `SELECT * FROM push_schedule
         WHERE next_at <= ?
         ORDER BY next_at ASC
         LIMIT ?`,
      )
      .all(now, limit) as Record<string, unknown>[];
    const upd = db.prepare(
      `UPDATE push_schedule
       SET last_sent_at = ?, next_at = ?, updated_at = ?
       WHERE id = ? AND next_at <= ?`,
    );
    const del = db.prepare("DELETE FROM push_schedule WHERE id = ?");
    for (const raw of rows) {
      const row = rowFromDb(raw);
      const next = advanceAfterFire(row, now);
      if (next == null) {
        del.run(row.id);
      } else {
        const bumped = Math.max(next, now + 5 * 60_000);
        upd.run(now, bumped, now, row.id, now);
      }
      claimed.push(row);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return claimed;
}
