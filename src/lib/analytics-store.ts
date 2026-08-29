import { getDb } from "@/lib/db";

export type AnalyticsEventName =
  | "visit"
  | "register"
  | "login"
  | "onboarding_done"
  | "chat_send"
  | "pricing_view"
  | "subscribe_click"
  | "subscribe_activate"
  | "community_post"
  | "push_enable"
  | "plan_purchase";

export type AnalyticsEvent = {
  id: string;
  at: string;
  name: AnalyticsEventName;
  day: string;
  visitorId?: string;
  meta?: string;
};

const MAX_EVENTS = 8_000;

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const ALLOWED = new Set<AnalyticsEventName>([
  "visit",
  "register",
  "login",
  "onboarding_done",
  "chat_send",
  "pricing_view",
  "subscribe_click",
  "subscribe_activate",
  "community_post",
  "push_enable",
  "plan_purchase",
]);

function trimOldEvents() {
  try {
    const db = getDb();
    const count = (
      db.prepare("SELECT COUNT(*) AS c FROM analytics_events").get() as {
        c: number;
      }
    ).c;
    if (count <= MAX_EVENTS) return;
    const cut = count - MAX_EVENTS;
    db.prepare(
      `DELETE FROM analytics_events WHERE id IN (
         SELECT id FROM analytics_events ORDER BY at ASC LIMIT ?
       )`,
    ).run(cut);
  } catch {
    /* ignore */
  }
}

/** Быстрый INSERT в SQLite — не блокирует чат перезаписью большого JSON */
export function trackAnalyticsEvent(input: {
  name: string;
  visitorId?: string;
  meta?: string;
  at?: string;
}): AnalyticsEvent | null {
  if (!ALLOWED.has(input.name as AnalyticsEventName)) return null;
  const at = input.at || new Date().toISOString();
  const row: AnalyticsEvent = {
    id: uid(),
    at,
    name: input.name as AnalyticsEventName,
    day: at.slice(0, 10),
    visitorId: input.visitorId?.slice(0, 64),
    meta: input.meta?.slice(0, 120),
  };

  try {
    getDb()
      .prepare(
        `INSERT INTO analytics_events (id, at, name, day, visitor_id, meta)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.at,
        row.name,
        row.day,
        row.visitorId ?? null,
        row.meta ?? null,
      );
    // trim редко, не на каждый чат
    if (Math.random() < 0.02) trimOldEvents();
  } catch {
    /* ignore */
  }
  return row;
}

export type DayStats = {
  day: string;
  visit: number;
  register: number;
  login: number;
  onboarding_done: number;
  chat_send: number;
  pricing_view: number;
  subscribe_click: number;
  subscribe_activate: number;
  community_post: number;
  push_enable: number;
  plan_purchase: number;
  uniqueVisitors: number;
};

export type AnalyticsSummary = {
  totals: Omit<DayStats, "day" | "uniqueVisitors"> & {
    uniqueVisitors: number;
  };
  byDay: DayStats[];
  recent: AnalyticsEvent[];
  funnel: {
    visitToRegisterPct: number;
    registerToOnboardPct: number;
    visitToChatPct: number;
    clickToPayPct: number;
  };
};

export function getAnalyticsSummary(days = 14): AnalyticsSummary {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const sinceDay = since.toISOString().slice(0, 10);

  const db = getDb();
  const filtered = db
    .prepare(
      `SELECT id, at, name, day, visitor_id AS visitorId, meta
       FROM analytics_events WHERE day >= ? ORDER BY at DESC LIMIT 8000`,
    )
    .all(sinceDay) as AnalyticsEvent[];

  const totals = {
    visit: 0,
    register: 0,
    login: 0,
    onboarding_done: 0,
    chat_send: 0,
    pricing_view: 0,
    subscribe_click: 0,
    subscribe_activate: 0,
    community_post: 0,
    push_enable: 0,
    plan_purchase: 0,
    uniqueVisitors: 0,
  };
  const uniqAll = new Set<string>();
  const byDayMap = new Map<string, DayStats>();

  function dayRow(day: string): DayStats {
    let row = byDayMap.get(day);
    if (!row) {
      row = {
        day,
        visit: 0,
        register: 0,
        login: 0,
        onboarding_done: 0,
        chat_send: 0,
        pricing_view: 0,
        subscribe_click: 0,
        subscribe_activate: 0,
        community_post: 0,
        push_enable: 0,
        plan_purchase: 0,
        uniqueVisitors: 0,
      };
      byDayMap.set(day, row);
    }
    return row;
  }

  const uniqByDay = new Map<string, Set<string>>();

  for (const e of filtered) {
    if (!(e.name in totals) || e.name === ("uniqueVisitors" as never)) continue;
    totals[e.name as Exclude<keyof typeof totals, "uniqueVisitors">] += 1;
    if (e.visitorId) uniqAll.add(e.visitorId);
    const row = dayRow(e.day);
    row[e.name] += 1;
    if (e.visitorId) {
      let set = uniqByDay.get(e.day);
      if (!set) {
        set = new Set();
        uniqByDay.set(e.day, set);
      }
      set.add(e.visitorId);
    }
  }

  totals.uniqueVisitors = uniqAll.size;
  for (const [day, set] of uniqByDay) {
    const row = byDayMap.get(day);
    if (row) row.uniqueVisitors = set.size;
  }

  const byDay = [...byDayMap.values()].sort((a, b) =>
    b.day.localeCompare(a.day),
  );
  const pct = (a: number, b: number) =>
    b > 0 ? Math.round((a / b) * 1000) / 10 : 0;

  return {
    totals,
    byDay,
    recent: filtered.slice(0, 80),
    funnel: {
      visitToRegisterPct: pct(
        totals.register,
        totals.visit || totals.uniqueVisitors,
      ),
      registerToOnboardPct: pct(totals.onboarding_done, totals.register),
      visitToChatPct: pct(
        totals.chat_send,
        totals.visit || totals.uniqueVisitors,
      ),
      clickToPayPct: pct(totals.subscribe_activate, totals.subscribe_click),
    },
  };
}

export function clearAnalytics() {
  try {
    getDb().exec("DELETE FROM analytics_events");
  } catch {
    /* ignore */
  }
}

export function analyticsPasswordOk(
  password: string | null | undefined,
): boolean {
  const expected =
    process.env.ANALYTICS_PASSWORD?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    "maya-stats";
  return Boolean(password && password === expected);
}
