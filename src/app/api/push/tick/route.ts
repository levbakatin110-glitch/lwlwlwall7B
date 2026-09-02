import { adminPasswordOk } from "@/lib/admin-auth";
import { runPushTick } from "@/lib/push-tick";

export const runtime = "nodejs";

function tickKeyOk(req: Request): boolean {
  const url = new URL(req.url);
  const key =
    url.searchParams.get("key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const cron = process.env.CRON_SECRET?.trim();
  if (cron && key === cron) return true;
  return adminPasswordOk(key);
}

/** Ручной/крон тик. На VPS ещё крутится цикл из instrumentation. */
export async function POST(req: Request) {
  if (!tickKeyOk(req)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await runPushTick();
  return Response.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return POST(req);
}
