import { requireAdmin } from "@/lib/admin-auth";
import { listOrders, orderForClient } from "@/lib/orders-store";
import { runLifecycleSweep } from "@/lib/plan-order-lifecycle";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нет доступа" }, { status: 401 });
  }
  runLifecycleSweep();
  const orders = listOrders().map(orderForClient);
  return Response.json({ ok: true, orders });
}
