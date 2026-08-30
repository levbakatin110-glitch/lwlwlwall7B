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
  const existing = getOrder(orderId);

  if (productId.startsWith("accompany_")) {
    if (existing?.status === "awaiting_payment") {
      const paid = fulfillPlanOrderPayment(orderId, paymentRef);
      if (!paid) return null;
      const withMonth = fulfillAccompanimentPayment(orderId, paymentRef, {
        skipIntro: true,
      });
      schedulePlanAiDraft(orderId);
      const out = withMonth ?? paid;
      void notifyNewPlanOrder(out).catch((e) =>
        console.error("[plan-activate] notify accompany-first", e),
      );
      return out;
    }

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
