import { readSessionFromRequest } from "@/lib/session";
import type { ScheduledPushItem } from "@/lib/care-reminders";
import { replaceScheduleForEmail } from "@/lib/push-schedule";

export const runtime = "nodejs";

const MAX = 60;

function sanitizeItem(raw: unknown): ScheduledPushItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ScheduledPushItem>;
  const id = typeof r.id === "string" ? r.id.trim().slice(0, 120) : "";
  const nextAt = Number(r.nextAt);
  if (!id || !Number.isFinite(nextAt)) return null;
  if (nextAt > Date.now() + 40 * 24 * 60 * 60 * 1000) return null;
  if (nextAt < Date.now() - 2 * 60 * 60 * 1000) return null;
  const mode = r.mode === "times" || r.mode === "once" ? r.mode : "interval";
  const title = String(r.title || "Мая").slice(0, 80);
  const body = String(r.body || "Напоминание").slice(0, 220);
  const url = String(r.url || "/").slice(0, 160);
  return {
    id,
    title,
    body,
    url: url.startsWith("/") ? url : "/",
    tag: String(r.tag || id).slice(0, 120),
    nextAt: Math.round(nextAt),
    mode,
    intervalMin:
      mode === "interval"
        ? Math.max(15, Math.min(24 * 60, Math.round(Number(r.intervalMin) || 180)))
        : undefined,
    times:
      mode === "times" && Array.isArray(r.times)
        ? r.times.map(String).slice(0, 8)
        : undefined,
    quietFrom: typeof r.quietFrom === "string" ? r.quietFrom : undefined,
    quietTo: typeof r.quietTo === "string" ? r.quietTo : undefined,
    tzOffsetMin: Math.round(Number(r.tzOffsetMin) || 0),
  };
}

export async function POST(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { items?: unknown[] };
    const items = (body.items ?? [])
      .map(sanitizeItem)
      .filter(Boolean)
      .slice(0, MAX) as ScheduledPushItem[];
    replaceScheduleForEmail(session.email, items);
    return Response.json({ ok: true, count: items.length });
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
}
