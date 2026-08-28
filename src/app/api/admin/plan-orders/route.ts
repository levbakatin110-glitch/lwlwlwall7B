import { requireAdmin } from "@/lib/admin-auth";
import { listOrders, orderForClient } from "@/lib/orders-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нет доступа" }, { status: 401 });
  }
  const orders = listOrders().map(orderForClient);
  return Response.json({ ok: true, orders });
}
