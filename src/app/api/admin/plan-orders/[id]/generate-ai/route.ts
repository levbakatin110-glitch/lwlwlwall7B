import { requireAdmin } from "@/lib/admin-auth";
import { generatePlanAiDraft } from "@/lib/plan-ai";
import { getOrder, orderForClient } from "@/lib/orders-store";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** Запустить или перезапустить ИИ-разбор и черновик PDF */
export async function POST(req: Request, ctx: Ctx) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нет доступа" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!getOrder(id)) {
    return Response.json({ error: "Не найдено" }, { status: 404 });
  }

  const order = await generatePlanAiDraft(id);
  if (!order) {
    return Response.json({ error: "Не найдено" }, { status: 404 });
  }

  return Response.json({ ok: true, order: orderForClient(order) });
}
