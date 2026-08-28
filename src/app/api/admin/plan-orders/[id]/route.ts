import { requireAdmin } from "@/lib/admin-auth";
import {
  getOrder,
  orderForClient,
  refreshDiarySnapshot,
  updateOrder,
  type OrderStatus,
} from "@/lib/orders-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES: OrderStatus[] = [
  "awaiting_payment",
  "paid",
  "contacted",
  "plan_sent",
  "clarifying",
  "closed",
  "accompaniment_active",
  "completed",
];

export async function GET(req: Request, ctx: Ctx) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нет доступа" }, { status: 401 });
  }
  const { id } = await ctx.params;
  let order = getOrder(id);
  if (!order) {
    return Response.json({ error: "Не найдено" }, { status: 404 });
  }
  order = refreshDiarySnapshot(id) ?? order;
  return Response.json({ ok: true, order: orderForClient(order) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нет доступа" }, { status: 401 });
  }
  const { id } = await ctx.params;
  let body: {
    status?: OrderStatus;
    closeChat?: boolean;
    aiDraft?: {
      analysis?: string;
      planText?: string;
      status?: "pending" | "ready" | "error";
      error?: string;
    };
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const patch: Parameters<typeof updateOrder>[1] = {};
  if (body.status && STATUSES.includes(body.status)) {
    patch.status = body.status;
  }
  if (body.closeChat) {
    patch.chatClosedAt = new Date().toISOString();
    patch.status = "closed";
  }
  if (body.aiDraft) {
    const prev = getOrder(id)?.aiDraft ?? {};
    patch.aiDraft = {
      ...prev,
      ...body.aiDraft,
      generatedAt: body.aiDraft.analysis || body.aiDraft.planText
        ? new Date().toISOString()
        : prev.generatedAt,
    };
  }

  const order = updateOrder(id, patch);
  if (!order) {
    return Response.json({ error: "Не найдено" }, { status: 404 });
  }
  return Response.json({ ok: true, order: orderForClient(order) });
}
