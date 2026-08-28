import { readSessionFromRequest } from "@/lib/session";
import {
  PLAN_ORDERS_SKIP_PAYMENT,
  PLAN_BREAKDOWN_RUB,
  planProductForTopic,
  type PlanTopic,
} from "@/lib/plan-products";
import {
  activeOrderForTopic,
  createOrder,
  ordersForEmail,
  orderForClient,
} from "@/lib/orders-store";
import { notifyNewPlanOrder } from "@/lib/admin-notify";
import type { JournalEntry } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите" }, { status: 401 });
  }
  const orders = ordersForEmail(session.email).map(orderForClient);
  return Response.json({ ok: true, orders });
}

export async function POST(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите" }, { status: 401 });
  }

  let body: {
    topic?: PlanTopic;
    childId?: string;
    childName?: string;
    entries?: JournalEntry[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const topic = body.topic;
  if (topic !== "sleep" && topic !== "feed") {
    return Response.json({ error: "Укажите тему: sleep или feed" }, { status: 400 });
  }

  const existing = activeOrderForTopic(session.email, topic);
  if (existing) {
    return Response.json({
      ok: true,
      order: orderForClient(existing),
      existing: true,
    });
  }

  const order = createOrder({
    email: session.email,
    topic,
    productId: planProductForTopic(topic),
    priceRub: PLAN_BREAKDOWN_RUB,
    childId: body.childId,
    childName: body.childName,
    clientEntries: body.entries,
    skipPayment: PLAN_ORDERS_SKIP_PAYMENT,
  });

  void notifyNewPlanOrder(order).catch((e) =>
    console.error("[plan-orders] notify", e),
  );

  return Response.json({ ok: true, order: orderForClient(order) });
}
