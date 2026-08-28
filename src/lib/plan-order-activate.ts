import { notifyNewPlanOrder } from "@/lib/admin-notify";
import { schedulePlanAiDraft } from "@/lib/plan-ai";
import {
  fulfillAccompanimentPayment,
  fulfillPlanOrderPayment,
  getOrder,
  type PlanOrder,
} from "@/lib/orders-store";
import type { PlanProductId } from "@/lib/plan-products";

export function activatePlanOrderAfterPayment(
  productId: PlanProductId,
  orderId: string,
  paymentRef?: string,
): PlanOrder | null {
  if (productId.startsWith("accompany_")) {
    const order = fulfillAccompanimentPayment(orderId, paymentRef);
    if (order) {
      void notifyNewPlanOrder(order).catch((e) =>
        console.error("[plan-activate] notify accompany", e),
      );
    }
    return order;
  }

  const order = fulfillPlanOrderPayment(orderId, paymentRef);
  if (!order) return null;

  schedulePlanAiDraft(orderId);
  void notifyNewPlanOrder(order).catch((e) =>
    console.error("[plan-activate] notify plan", e),
  );
  return order;
}

export function activatePlanOrderBypass(orderId: string): PlanOrder | null {
  const order = getOrder(orderId);
  if (!order) return null;
  if (order.productId.startsWith("accompany_")) {
    return activatePlanOrderAfterPayment(order.productId, orderId, "bypass");
  }
  return activatePlanOrderAfterPayment(order.productId, orderId, "bypass");
}
