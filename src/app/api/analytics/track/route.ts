import { trackAnalyticsEvent } from "@/lib/analytics-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      visitorId?: string;
      meta?: string;
    };
    const row = trackAnalyticsEvent({
      name: String(body.name || ""),
      visitorId: body.visitorId,
      meta: body.meta,
    });
    if (!row) {
      return Response.json({ error: "unknown event" }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
}
