import { touchPresence } from "@/lib/presence";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      visitorId?: string;
      path?: string;
    };
    const ok = touchPresence({
      visitorId: String(body.visitorId || ""),
      path: String(body.path || "/"),
    });
    return Response.json({ ok });
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
}
