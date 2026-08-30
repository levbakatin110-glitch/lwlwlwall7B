import { grantPaidPlan } from "@/lib/paid-store";
import { readSessionFromRequest } from "@/lib/session";
import {
  FAKE_PAYMENTS,
  type PaidPlanId,
  PAID_PLANS,
} from "@/lib/subscription";

export const runtime = "nodejs";

/** Временная «оплата» без кассы — только пока FAKE_PAYMENTS = true. */
export async function POST(req: Request) {
  if (!FAKE_PAYMENTS) {
    return Response.json({ error: "Фейковая оплата выключена" }, { status: 403 });
  }

  let body: { planId?: string; email?: string };
  try {
    body = (await req.json()) as { planId?: string; email?: string };
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const planId = body.planId as PaidPlanId | undefined;
  if (!planId || !PAID_PLANS.some((p) => p.id === planId)) {
    return Response.json({ error: "Неизвестный тариф" }, { status: 400 });
  }

  const session = readSessionFromRequest(req);
  const email = (session?.email || body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return Response.json({ error: "Нужен email" }, { status: 401 });
  }

  const row = grantPaidPlan({
    email,
    planId,
    orderId: `fake-${Date.now()}`,
  });

  return Response.json({
    ok: true,
    planId: row.planId,
    expiresAt: row.expiresAt,
    fake: true,
  });
}
