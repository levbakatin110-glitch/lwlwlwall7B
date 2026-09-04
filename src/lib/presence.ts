import { getDb } from "@/lib/db";

/** Вкладка считается онлайн, если пинг был не позже этого окна. */
export const ONLINE_WINDOW_MS = 90_000;
/** Недавно на сайте (вкладка могла уйти в фон). */
export const RECENT_WINDOW_MS = 5 * 60_000;
const MIN_HEARTBEAT_GAP_MS = 12_000;
const PRUNE_AFTER_MS = 15 * 60_000;

export type PresenceScreen =
  | "home"
  | "community"
  | "diary"
  | "pricing"
  | "profile"
  | "med"
  | "wardrobe"
  | "recipes"
  | "reminders"
  | "summary"
  | "plan"
  | "other";

const SCREENS = new Set<PresenceScreen>([
  "home",
  "community",
  "diary",
  "pricing",
  "profile",
  "med",
  "wardrobe",
  "recipes",
  "reminders",
  "summary",
  "plan",
  "other",
]);

export function screenFromPath(path: string): PresenceScreen {
  const p = (path.split("?")[0] || "/").trim() || "/";
  if (p === "/") return "home";
  if (p.startsWith("/community")) return "community";
  if (p.startsWith("/m/") || p.startsWith("/modules")) return "diary";
  if (p.startsWith("/pricing")) return "pricing";
  if (p.startsWith("/profile")) return "profile";
  if (p.startsWith("/med")) return "med";
  if (p.startsWith("/wardrobe")) return "wardrobe";
  if (p.startsWith("/recipes")) return "recipes";
  if (p.startsWith("/reminders")) return "reminders";
  if (p.startsWith("/summary")) return "summary";
  if (p.startsWith("/plan")) return "plan";
  return "other";
}

function cleanPath(path: string): string {
  return (path.split("?")[0] || "/").slice(0, 80);
}

function pruneOld(db: ReturnType<typeof getDb>, now: number) {
  db.prepare("DELETE FROM presence_heartbeats WHERE last_seen < ?").run(
    now - PRUNE_AFTER_MS,
  );
}

export function touchPresence(input: {
  visitorId: string;
  path?: string;
}): boolean {
  const visitorId = input.visitorId.trim().slice(0, 64);
  if (!visitorId || visitorId === "anon") return false;
  const path = cleanPath(input.path || "/");
  if (path.startsWith("/admin") || path.startsWith("/legal")) return false;
  const screen = screenFromPath(path);
  const now = Date.now();
  const db = getDb();

  const prev = db
    .prepare(
      "SELECT last_seen AS lastSeen FROM presence_heartbeats WHERE visitor_id = ?",
    )
    .get(visitorId) as { lastSeen: number } | undefined;
  if (prev && now - prev.lastSeen < MIN_HEARTBEAT_GAP_MS) return true;

  db.prepare(
    `INSERT INTO presence_heartbeats (visitor_id, last_seen, screen, path)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(visitor_id) DO UPDATE SET
       last_seen = excluded.last_seen,
       screen = excluded.screen,
       path = excluded.path`,
  ).run(visitorId, now, screen, path);

  if (Math.random() < 0.08) pruneOld(db, now);
  return true;
}

export type PresenceSnapshot = {
  online: number;
  recent: number;
  byScreen: Partial<Record<PresenceScreen, number>>;
};

export function presenceSnapshot(now = Date.now()): PresenceSnapshot {
  const db = getDb();
  pruneOld(db, now);
  const rows = db
    .prepare(
      `SELECT screen, last_seen AS lastSeen
       FROM presence_heartbeats WHERE last_seen >= ?`,
    )
    .all(now - RECENT_WINDOW_MS) as { screen: string; lastSeen: number }[];

  const byScreen: Partial<Record<PresenceScreen, number>> = {};
  let online = 0;
  for (const row of rows) {
    if (row.lastSeen >= now - ONLINE_WINDOW_MS) {
      online += 1;
      const screen = SCREENS.has(row.screen as PresenceScreen)
        ? (row.screen as PresenceScreen)
        : "other";
      byScreen[screen] = (byScreen[screen] || 0) + 1;
    }
  }
  return { online, recent: rows.length, byScreen };
}

export function moscowDay(at = Date.now()): string {
  return new Date(at).toLocaleDateString("en-CA", {
    timeZone: "Europe/Moscow",
  });
}

export function noteLivePeaks(online: number, chatActive: number) {
  const day = moscowDay();
  const now = Date.now();
  const db = getDb();
  const prev = db
    .prepare(
      `SELECT peak_online AS peakOnline, peak_chat AS peakChat
       FROM live_peaks WHERE day = ?`,
    )
    .get(day) as { peakOnline: number; peakChat: number } | undefined;
  const peakOnline = Math.max(prev?.peakOnline ?? 0, online);
  const peakChat = Math.max(prev?.peakChat ?? 0, chatActive);
  db.prepare(
    `INSERT INTO live_peaks (day, peak_online, peak_chat, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       peak_online = excluded.peak_online,
       peak_chat = excluded.peak_chat,
       updated_at = excluded.updated_at`,
  ).run(day, peakOnline, peakChat, now);
  return { day, peakOnline, peakChat };
}
