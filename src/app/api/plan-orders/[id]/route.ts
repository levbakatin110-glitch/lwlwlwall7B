import { readSessionFromRequest } from "@/lib/session";
import { getOrder, orderForClient } from "@/lib/orders-store";
import { normalizeEmail } from "@/lib/email-codes";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

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
  return Response.json({ ok: true, order: orderForClient(order) });
}
