import { readSessionFromRequest } from "@/lib/session";
import {
  ACCOMPANIMENT_RUB,
  PLAN_BREAKDOWN_RUB,
  accompanyProductForTopic,
  planPaymentsBypass,
  planPaymentsLive,
  planProductForTopic,
  priceForProduct,
  type PlanTopic,
} from "@/lib/plan-products";
import {
  buildProdamusPlanPayload,
  createProdamusPayUrl,
} from "@/lib/plan-payments";
import { activatePlanOrderAfterPayment } from "@/lib/plan-order-activate";
import {
  createPlanOrder,
  getOrder,
  markAccompanimentPending,
  orderForClient,
} from "@/lib/orders-store";
import type { JournalEntry } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите в аккаунт" }, { status: 401 });
  }

  let body: {
    kind?: "plan" | "accompany";
    topic?: PlanTopic;
    parentOrderId?: string;
    childId?: string;
    childName?: string;
    entries?: JournalEntry[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const kind = body.kind ?? "plan";

  if (kind === "accompany") {
    const parentId = body.parentOrderId?.trim();
    if (!parentId) {
      return Response.json({ error: "Нет заказа" }, { status: 400 });
    }
    const parent = getOrder(parentId);
    if (!parent || parent.email !== session.email) {
      return Response.json({ error: "Заказ не найден" }, { status: 404 });
    }
    if (!parent.chatClosedAt && parent.status !== "closed") {
      return Response.json(
        { error: "Сопровождение доступно после завершения разбора" },
        { status: 400 },
      );
    }
    if (parent.accompanimentPaid) {
      return Response.json({
        ok: true,
        order: orderForClient(parent),
        already: true,
      });
    }

    const productId = accompanyProductForTopic(parent.topic);
    markAccompanimentPending(parentId);

    if (planPaymentsBypass()) {
      const activated = activatePlanOrderAfterPayment(
        productId,
        parentId,
        "bypass",
      );
      return Response.json({
        ok: true,
        order: orderForClient(activated!),
        redirect: `/plan/${parentId}`,
      });
    }

    if (!planPaymentsLive()) {
      return Response.json(
        { error: "Оплата временно недоступна. Попробуйте чуть позже." },
        { status: 503 },
      );
    }

    const built = buildProdamusPlanPayload({
      productId,
      orderId: parentId,
      email: session.email,
      successPath: `/plan/order/success?order=${encodeURIComponent(parentId)}&kind=accompany`,
      returnPath: `/plan/${parentId}`,
    });
    if ("error" in built) {
      return Response.json({ error: built.error }, { status: 503 });
    }
    const url = await createProdamusPayUrl(built.data, built.payform);
    if (!url) {
      return Response.json({ error: "Не удалось создать оплату" }, { status: 502 });
    }
    return Response.json({ ok: true, url, orderId: parentId });
  }

  const topic = body.topic;
  if (topic !== "sleep" && topic !== "feed") {
    return Response.json({ error: "Укажите тему" }, { status: 400 });
  }

  const entries =
    body.entries && body.entries.length > 0 ? body.entries : undefined;

  const order = createPlanOrder({
    email: session.email,
    topic,
    productId: planProductForTopic(topic),
    priceRub: PLAN_BREAKDOWN_RUB,
    childId: body.childId,
    childName: body.childName,
    clientEntries: entries,
  });

  if (order.status !== "awaiting_payment") {
    return Response.json({
      ok: true,
      order: orderForClient(order),
      redirect: `/plan/${order.id}`,
      existing: true,
    });
  }

  if (planPaymentsBypass()) {
    const activated = activatePlanOrderAfterPayment(
      order.productId,
      order.id,
      "bypass",
    );
    return Response.json({
      ok: true,
      order: orderForClient(activated!),
      redirect: `/plan/${order.id}`,
    });
  }

  if (!planPaymentsLive()) {
    return Response.json(
      { error: "Оплата временно недоступна. Попробуйте чуть позже." },
      { status: 503 },
    );
  }

  const built = buildProdamusPlanPayload({
    productId: order.productId,
    orderId: order.id,
    email: session.email,
    successPath: `/plan/order/success?order=${encodeURIComponent(order.id)}`,
    returnPath: `/plan/order?topic=${topic}`,
  });
  if ("error" in built) {
    return Response.json({ error: built.error }, { status: 503 });
  }
  const url = await createProdamusPayUrl(built.data, built.payform);
  if (!url) {
    return Response.json({ error: "Не удалось создать оплату" }, { status: 502 });
  }

  return Response.json({
    ok: true,
    url,
    orderId: order.id,
    priceRub: priceForProduct(order.productId),
  });
}
