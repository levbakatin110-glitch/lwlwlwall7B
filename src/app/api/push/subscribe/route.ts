import { readSessionFromRequest } from "@/lib/session";
import {
  removePushSubscription,
  savePushSubscription,
  type PushSubscriptionJSON,
} from "@/lib/push-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { subscription?: PushSubscriptionJSON };
    if (!body.subscription?.endpoint) {
      return Response.json({ error: "Нет подписки" }, { status: 400 });
    }
    savePushSubscription(session.email, body.subscription);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { endpoint?: string };
    if (body.endpoint) removePushSubscription(body.endpoint);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}
