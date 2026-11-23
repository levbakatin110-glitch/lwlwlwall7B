import { CHAT_TOPUP_MSGS, CHAT_TOPUP_RUB } from "@/lib/chat-quota";
import { grantChatTopup } from "@/lib/chat-quota-store";
import { hitRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { readSessionFromRequest } from "@/lib/session";
import { FAKE_PAYMENTS, planById, type PaidPlanId } from "@/lib/subscription";
import { rememberYookassaPayment } from "@/lib/yookassa-payments";
import { yookassaCreatePayment, yookassaReady, yookassaSite } from "@/lib/yookassa";

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

  if (!yookassaReady()) {
    return Response.json(
      { error: "Оплата ещё не настроена на сервере." },
      { status: 503 },
    );
  }

  /** Доплата за пакет чата */
  if (body.kind === "chat_boost") {
    if (FAKE_PAYMENTS) {
      const orderId = `fake-chatboost-${Date.now()}`;
      const limit = hitRateLimit(`fake-topup:${email}`, 1, 86_400);
      if (!limit.ok) return tooManyRequests(limit);
      const quota = grantChatTopup(email, orderId, "fake");
      return Response.json({
        ok: true,
        bypass: true,
        orderId,
        quota,
        message: `Добавлено +${CHAT_TOPUP_MSGS} сообщений`,
      });
    }
    return startCheckout({
      email,
      kind: "chat_boost",
      planId: null,
      amountRub: CHAT_TOPUP_RUB,
      description: `Мая · пакет чата +${CHAT_TOPUP_MSGS} сообщ.`,
      returnUrl: `${yookassaSite()}/?chatTopup=1`,
    });
  }

  const planId = body.planId as PaidPlanId;
  const plan = planById(planId);
  if (!plan) {
    return Response.json({ error: "Нужен тариф" }, { status: 400 });
  }

  return startCheckout({
    email,
    kind: "subscription",
    planId,
    amountRub: plan.priceRub,
    description: `Мая Premium · ${plan.label}`,
    returnUrl: `${yookassaSite()}/pricing?paid=1`,
  });
}

async function startCheckout(opts: {
  email: string;
  kind: "subscription" | "chat_boost";
  planId: PaidPlanId | null;
  amountRub: number;
  description: string;
  returnUrl: string;
}) {
  try {
    const payment = await yookassaCreatePayment({
      amountRub: opts.amountRub,
      description: opts.description,
      returnUrl: opts.returnUrl,
      email: opts.email,
      metadata: {
        email: opts.email,
        kind: opts.kind,
        planId: opts.planId ?? "",
      },
    });
    rememberYookassaPayment({
      paymentId: payment.id,
      email: opts.email,
      kind: opts.kind,
      planId: opts.planId,
      amountRub: opts.amountRub,
    });
    return Response.json({ url: payment.url, orderId: payment.id });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Не удалось создать ссылку на оплату. Попробуйте ещё раз.",
      },
      { status: 502 },
    );
  }
}
