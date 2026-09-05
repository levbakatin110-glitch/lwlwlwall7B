import { readSessionFromRequest } from "@/lib/session";
import { pushConfigured, sendPushToEmail } from "@/lib/push-send";

export const runtime = "nodejs";

/** Проверка: пуш на этот аккаунт, если есть подписка. */
export async function POST(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите" }, { status: 401 });
  }
  if (!pushConfigured()) {
    return Response.json({ error: "push_not_configured", sent: 0 }, { status: 503 });
  }
  const r = await sendPushToEmail(session.email, {
    title: "Мая",
    body: "Проверка: уведомления доходят.",
    url: "/reminders",
    tag: "maya-test",
  });
  return Response.json({ ok: true, ...r });
}
