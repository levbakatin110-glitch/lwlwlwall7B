import { readSessionFromRequest } from "@/lib/session";
import { normalizeEmail } from "@/lib/email-codes";
import {
  appendMessage,
  getOrder,
  orderForClient,
} from "@/lib/orders-store";
import { notifyPlanOrderMessage } from "@/lib/admin-notify";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const MAX_TEXT = 2000;

export async function GET(req: Request, ctx: Ctx) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const order = getOrder(id);
  if (!order || normalizeEmail(order.email) !== normalizeEmail(session.email)) {
    return Response.json({ error: "Не найдено" }, { status: 404 });
  }
  return Response.json({ ok: true, messages: orderForClient(order).messages });
}

export async function POST(req: Request, ctx: Ctx) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const order = getOrder(id);
  if (!order || normalizeEmail(order.email) !== normalizeEmail(session.email)) {
    return Response.json({ error: "Не найдено" }, { status: 404 });
  }
  if (order.chatClosedAt) {
    return Response.json({ error: "Чат закрыт" }, { status: 403 });
  }

  let body: { text?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const text = body.text?.trim();
  if (!text || text.length > MAX_TEXT) {
    return Response.json({ error: "Пустое или слишком длинное сообщение" }, { status: 400 });
  }

  const updated = appendMessage(id, { role: "user", text });
  if (!updated) {
    return Response.json({ error: "Не удалось отправить" }, { status: 400 });
  }

  void notifyPlanOrderMessage(updated, true, text).catch((e) =>
    console.error("[plan-orders] notify msg", e),
  );

  return Response.json({ ok: true, order: orderForClient(updated) });
}
