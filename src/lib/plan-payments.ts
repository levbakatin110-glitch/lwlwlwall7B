import { prodamusConfig, prodamusSign } from "@/lib/prodamus";
import {
  PLAN_PRODUCT_TITLE,
  priceForProduct,
  type PlanProductId,
} from "@/lib/plan-products";

export function prodamusPlanExtra(productId: PlanProductId, orderId: string) {
  return `plan:${productId}:${orderId}`;
}

export function parseProdamusPlanExtra(extra: string): {
  productId: PlanProductId;
  orderId: string;
} | null {
  const m = extra.match(/^plan:(plan_sleep|plan_feed|accompany_sleep|accompany_feed):(.+)$/);
  if (!m) return null;
  return {
    productId: m[1] as PlanProductId,
    orderId: m[2]!,
  };
}

export function buildProdamusPlanPayload(opts: {
  productId: PlanProductId;
  orderId: string;
  email: string;
  successPath: string;
  returnPath: string;
}): { data: Record<string, unknown>; payform: string } | { error: string } {
  const { secret, payform, site } = prodamusConfig();
  if (!secret || !payform) {
    return { error: "Оплата временно недоступна. Попробуйте позже." };
  }

  const paymentOrderId = `maya-${opts.productId}-${opts.orderId}`;
  const price = priceForProduct(opts.productId);
  const title = PLAN_PRODUCT_TITLE[opts.productId];

  const data: Record<string, unknown> = {
    order_id: paymentOrderId,
    customer_email: opts.email,
    customer_extra: prodamusPlanExtra(opts.productId, opts.orderId),
    products: [
      {
        name: `Мая · ${title}`,
        price: String(price),
        quantity: "1",
      },
    ],
    do: "link",
    urlSuccess: `${site}${opts.successPath}`,
    urlReturn: `${site}${opts.returnPath}`,
    urlNotification: `${site}/api/payments/prodamus`,
  };

  data.signature = prodamusSign(data, secret);

  return { data, payform };
}

export async function createProdamusPayUrl(
  data: Record<string, unknown>,
  payform: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${payform}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: toFormBody(data),
    });
    const text = (await res.text()).trim();
    if (text.startsWith("http")) return text;
  } catch {
    /* fallback */
  }

  const q = new URLSearchParams();
  const flat = data as Record<string, string | unknown>;
  q.set("order_id", String(flat.order_id));
  q.set("customer_email", String(flat.customer_email));
  q.set("customer_extra", String(flat.customer_extra));
  const products = flat.products as { name: string; price: string; quantity: string }[];
  if (products?.[0]) {
    q.set("products[0][name]", products[0].name);
    q.set("products[0][price]", products[0].price);
    q.set("products[0][quantity]", products[0].quantity);
  }
  q.set("urlSuccess", String(flat.urlSuccess));
  q.set("urlReturn", String(flat.urlReturn));
  q.set("do", "pay");
  return `${payform}/?${q.toString()}`;
}

function toFormBody(data: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === "object") {
          parts.push(
            toFormBody(item as Record<string, unknown>, `${name}[${i}]`),
          );
        } else {
          parts.push(
            `${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`,
          );
        }
      });
    } else if (value && typeof value === "object") {
      parts.push(toFormBody(value as Record<string, unknown>, name));
    } else if (value != null) {
      parts.push(
        `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`,
      );
    }
  }
  return parts.filter(Boolean).join("&");
}
