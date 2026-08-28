import { readSessionFromRequest } from "@/lib/session";
import {
  ordersForEmail,
  orderForClient,
} from "@/lib/orders-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите" }, { status: 401 });
  }
  const orders = ordersForEmail(session.email)
    .filter((o) => o.status !== "awaiting_payment")
    .map(orderForClient);
  return Response.json({ ok: true, orders });
}
