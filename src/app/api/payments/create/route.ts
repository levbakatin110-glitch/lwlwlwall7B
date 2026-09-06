import { CHAT_TOPUP_MSGS, CHAT_TOPUP_RUB } from "@/lib/chat-quota";
import { grantChatTopup } from "@/lib/chat-quota-store";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { planPaymentsBypass } from "@/lib/plan-products";
import { prodamusConfig, prodamusSign } from "@/lib/prodamus";
import { readSessionFromRequest } from "@/lib/session";
import { FAKE_PAYMENTS, planById, type PaidPlanId } from "@/lib/subscription";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = readSessionFromRequest(req);
  const email = session?.email?.trim().toLowerCase() || "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Войдите в аккаунт" }, { status: 401 });
  }

  let body: { planId?: string; kind?: string };
  try {
    body = (await req.json()) as {
      planId?: string;
      kind?: string;
    };
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  /** Доплата за пакет чата */
  if (body.kind === "chat_boost") {
    const orderId = `maya-chatboost-${Date.now()}`;
    if (FAKE_PAYMENTS || planPaymentsBypass()) {
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
      const res = await fetchWithTimeout(payform + "/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: toFormBody(data),
        timeoutMs: 10_000,
      });
      const text = (await res.text()).trim();
      if (text.startsWith("http")) {
        return Response.json({ url: text, orderId });
      }
    } catch {
      /* fail closed */
    }
    return Response.json(
      { error: "Не удалось создать ссылку на оплату. Попробуйте ещё раз." },
      { status: 502 },
    );
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
      const res = await fetchWithTimeout(payform + "/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: toFormBody(data),
        timeoutMs: 10_000,
      });
      const text = (await res.text()).trim();
      if (text.startsWith("http")) {
        return Response.json({ url: text, orderId });
      }
    } catch {
      /* fail closed */
    }

    return Response.json(
      { error: "Не удалось создать ссылку на оплату. Попробуйте ещё раз." },
      { status: 502 },
    );
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
