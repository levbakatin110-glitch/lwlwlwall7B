import { CHAT_TOPUP_MSGS, CHAT_TOPUP_RUB } from "@/lib/chat-quota";
import { grantChatTopup } from "@/lib/chat-quota-store";
import { planPaymentsBypass } from "@/lib/plan-products";
import { prodamusConfig, prodamusSign } from "@/lib/prodamus";
import { planById, type PaidPlanId } from "@/lib/subscription";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { planId?: string; email?: string; kind?: string };
  try {
    body = (await req.json()) as {
      planId?: string;
      email?: string;
      kind?: string;
    };
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Нужна почта аккаунта" }, { status: 400 });
  }

  /** Доплата за пакет чата */
  if (body.kind === "chat_boost") {
    const orderId = `maya-chatboost-${Date.now()}`;
    if (planPaymentsBypass()) {
      const quota = grantChatTopup(email, orderId);
      return Response.json({
        ok: true,
        bypass: true,
        orderId,
        quota,
        message: `Добавлено +${CHAT_TOPUP_MSGS} сообщений`,
      });
    }

    const { secret, payform, site } = prodamusConfig();
    if (!secret || !payform) {
      return Response.json(
        {
          error:
            "Оплата ещё не настроена на сервере (PRODAMUS_SECRET_KEY / PRODAMUS_PAYFORM_URL).",
        },
        { status: 503 },
      );
    }

    const data: Record<string, unknown> = {
      order_id: orderId,
      customer_email: email,
      customer_extra: `chat_boost:${orderId}`,
      products: [
        {
          name: `Maya · пакет чата +${CHAT_TOPUP_MSGS} сообщ.`,
          price: String(CHAT_TOPUP_RUB),
          quantity: "1",
        },
      ],
      do: "link",
      urlSuccess: `${site}/?chatTopup=1`,
      urlReturn: `${site}/`,
      urlNotification: `${site}/api/payments/prodamus`,
    };
    data.signature = prodamusSign(data, secret);

    try {
      const res = await fetch(payform + "/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: toFormBody(data),
      });
      const text = (await res.text()).trim();
      if (text.startsWith("http")) {
        return Response.json({ url: text, orderId });
      }
    } catch {
      /* fallback */
    }

    const q = new URLSearchParams();
    q.set("order_id", orderId);
    q.set("customer_email", email);
    q.set("customer_extra", `chat_boost:${orderId}`);
    q.set("products[0][name]", `Maya · пакет чата +${CHAT_TOPUP_MSGS}`);
    q.set("products[0][price]", String(CHAT_TOPUP_RUB));
    q.set("products[0][quantity]", "1");
    q.set("urlSuccess", `${site}/?chatTopup=1`);
    q.set("urlReturn", `${site}/`);
    q.set("do", "pay");
    return Response.json({ url: `${payform}/?${q.toString()}`, orderId });
  }

  const { secret, payform, site } = prodamusConfig();
  if (!secret || !payform) {
    return Response.json(
      {
        error:
          "Оплата ещё не настроена на сервере (PRODAMUS_SECRET_KEY / PRODAMUS_PAYFORM_URL).",
      },
      { status: 503 },
    );
  }

  const planId = body.planId as PaidPlanId;
  const plan = planById(planId);

  if (!plan) {
    return Response.json(
      { error: "Нужны тариф и почта аккаунта" },
      { status: 400 },
    );
  }

  const orderId = `maya-${planId}-${Date.now()}`;
  const data: Record<string, unknown> = {
    order_id: orderId,
    customer_email: email,
    customer_extra: planId,
    products: [
      {
        name: `Maya Premium · ${plan.label}`,
        price: String(plan.priceRub),
        quantity: "1",
      },
    ],
    do: "link",
    urlSuccess: `${site}/pricing?paid=1`,
    urlReturn: `${site}/pricing`,
    urlNotification: `${site}/api/payments/prodamus`,
  };

  data.signature = prodamusSign(data, secret);

  try {
    const res = await fetch(payform + "/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: toFormBody(data),
    });
    const text = (await res.text()).trim();
    if (text.startsWith("http")) {
      return Response.json({ url: text, orderId });
    }
  } catch {
    // fallback ниже
  }

  const q = new URLSearchParams();
  q.set("order_id", orderId);
  q.set("customer_email", email);
  q.set("customer_extra", planId);
  q.set("products[0][name]", `Maya Premium · ${plan.label}`);
  q.set("products[0][price]", String(plan.priceRub));
  q.set("products[0][quantity]", "1");
  q.set("urlSuccess", `${site}/pricing?paid=1`);
  q.set("urlReturn", `${site}/pricing`);
  q.set("do", "pay");

  return Response.json({
    url: `${payform}/?${q.toString()}`,
    orderId,
  });
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
