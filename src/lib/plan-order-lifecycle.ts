import {
  getOrder,
  listOrders,
  updateOrder,
  type PlanOrder,
} from "@/lib/orders-store";

const ACCOMPANIMENT_PENDING_TTL_MS = 45 * 60 * 1000;

function persistLifecyclePatch(
  order: PlanOrder,
  patch: Parameters<typeof updateOrder>[1],
): PlanOrder {
  const updated = updateOrder(order.id, patch);
  return updated ?? { ...order, ...patch, updatedAt: new Date().toISOString() };
}

/** Автозакрытие чата, завершение сопровождения, сброс зависшей оплаты */
export function applyOrderLifecycle(order: PlanOrder): PlanOrder {
  const now = Date.now();

  if (
    order.accompanimentPending &&
    now - new Date(order.updatedAt).getTime() > ACCOMPANIMENT_PENDING_TTL_MS
  ) {
    return persistLifecyclePatch(order, { accompanimentPending: false });
  }

  if (
    order.accompanimentPaid &&
    order.accompanimentDeadlineAt &&
    now > new Date(order.accompanimentDeadlineAt).getTime() &&
    order.status !== "completed"
  ) {
    return persistLifecyclePatch(order, {
      status: "completed",
      chatClosedAt: order.chatClosedAt ?? new Date().toISOString(),
      accompanimentPending: false,
    });
  }

  if (
    !order.chatClosedAt &&
    !order.accompanimentPaid &&
    order.chatDeadlineAt &&
    now > new Date(order.chatDeadlineAt).getTime() &&
    (order.status === "plan_sent" ||
      order.status === "clarifying" ||
      order.status === "contacted")
  ) {
    return persistLifecyclePatch(order, {
      chatClosedAt: new Date().toISOString(),
      status: "closed",
    });
  }

  return order;
}

export function runLifecycleSweep(): number {
  let n = 0;
  for (const o of listOrders()) {
    const before = `${o.status}|${o.chatClosedAt}|${o.accompanimentPending}`;
    const after = applyOrderLifecycle(getOrder(o.id) ?? o);
    const afterKey = `${after.status}|${after.chatClosedAt}|${after.accompanimentPending}`;
    if (before !== afterKey) n += 1;
  }
  return n;
}
