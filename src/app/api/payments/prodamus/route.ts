import { trackAnalyticsEvent } from "@/lib/analytics-store";
import { grantPaidPlan } from "@/lib/paid-store";
import { activatePlanOrderAfterPayment } from "@/lib/plan-order-activate";
import { parseProdamusPlanExtra } from "@/lib/plan-payments";
import { prodamusConfig, prodamusVerify } from "@/lib/prodamus";
import { pushServerOpsError } from "@/lib/ops-log";
import { planById, type PaidPlanId } from "@/lib/subscription";

export const runtime = "nodejs";

function asObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const products: Record<string, Record<string, string>> = {};

  for (const [key, value] of form.entries()) {
    const v = typeof value === "string" ? value : value.name;
    const m = key.match(/^products\[(\d+)\]\[(\w+)\]$/);
    if (m) {
      const idx = m[1]!;
      const field = m[2]!;
      if (!products[idx]) products[idx] = {};
      products[idx]![field] = v;
      continue;
    }
    out[key] = v;
  }

  const productList = Object.keys(products)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => products[k]!);
  if (productList.length) out.products = productList;
  return out;
}

function resolvePlanId(extra: string, orderNum: string): PaidPlanId | null {
  const raw = `${extra} ${orderNum}`.toLowerCase();
  if (/\bm6\b|6\s*мес/.test(raw)) return "m6";
  if (/\bm3\b|3\s*мес/.test(raw)) return "m3";
  if (/\bm1\b|1\s*мес/.test(raw)) return "m1";
  if (raw.includes("m6")) return "m6";
  if (raw.includes("m3")) return "m3";
  if (raw.includes("m1")) return "m1";
  return null;
}

export async function POST(req: Request) {
  const { secret } = prodamusConfig();
  if (!secret) {
    return new Response("prodamus not configured", { status: 500 });
  }

  try {
    const form = await req.formData();
    const data = asObject(form);
    const sign =
      req.headers.get("Sign") ||
      req.headers.get("sign") ||
      (typeof data.sign === "string" ? data.sign : null);

    // Prodamus иногда кладёт копию в submit
    const payload =
      data.submit && typeof data.submit === "object"
        ? data.submit
        : data;

    if (!prodamusVerify(payload, secret, sign)) {
      // fallback: verify whole body without nested submit
      if (!prodamusVerify(data, secret, sign)) {
        pushServerOpsError({
          source: "other",
          message: "Prodamus: неверная подпись webhook",
          status: 403,
        });
        return new Response("bad signature", { status: 403 });
      }
    }

    const status = String(data.payment_status || "").toLowerCase();
    if (status && status !== "success") {
      return new Response("ok", { status: 200 });
    }

    const email = String(data.customer_email || "").trim().toLowerCase();
    const extra = String(data.customer_extra || "");
    const orderNum = String(data.order_num || data.order_id || "");
    const paymentRef = String(data.order_id || orderNum || "");

    const planPay = parseProdamusPlanExtra(extra);
    if (planPay && email) {
      activatePlanOrderAfterPayment(
        planPay.productId,
        planPay.orderId,
        paymentRef,
      );
      trackAnalyticsEvent({
        name: "plan_purchase",
        meta: `${planPay.productId}:${email.slice(0, 20)}`,
      });
      return new Response("ok", { status: 200 });
    }

    const planId = resolvePlanId(extra, orderNum);

    if (!email || !planId || !planById(planId)) {
      pushServerOpsError({
        source: "other",
        message: "Prodamus: нет email или planId",
        detail: `${email}|${extra}|${orderNum}`,
        status: 400,
      });
      // всё равно 200, чтобы не долбили ретраями при кривых тестовых хуках
      return new Response("ok", { status: 200 });
    }

    grantPaidPlan({
      email,
      planId,
      orderId: String(data.order_id || orderNum),
    });
    trackAnalyticsEvent({
      name: "subscribe_activate",
      meta: `${planId}:${email.slice(0, 24)}`,
    });

    return new Response("ok", { status: 200 });
  } catch (err) {
    pushServerOpsError({
      source: "other",
      message: err instanceof Error ? err.message : "Prodamus webhook error",
      status: 500,
    });
    return new Response("error", { status: 500 });
  }
}
