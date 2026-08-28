import { randomBytes } from "crypto";
import { writeFileSync } from "fs";
import { join } from "path";
import { requireAdmin } from "@/lib/admin-auth";
import {
  appendMessage,
  getOrder,
  orderForClient,
  pdfDir,
  updateOrder,
} from "@/lib/orders-store";
import { notifyMomPlanTeamReply } from "@/lib/plan-notify";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const MAX_TEXT = 8000;

export async function POST(req: Request, ctx: Ctx) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нет доступа" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const order = getOrder(id);
  if (!order) {
    return Response.json({ error: "Не найдено" }, { status: 404 });
  }
  if (order.chatClosedAt && order.status !== "accompaniment_active") {
    return Response.json({ error: "Чат закрыт" }, { status: 403 });
  }

  const ctype = req.headers.get("content-type") || "";

  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    const text = String(form.get("text") ?? "").trim();
    const file = form.get("pdf");
    let pdfFile: string | undefined;

    if (file && file instanceof File && file.size > 0) {
      if (file.size > 8_000_000) {
        return Response.json({ error: "PDF слишком большой" }, { status: 400 });
      }
      const name = `plan-${id.slice(-8)}-${randomBytes(3).toString("hex")}.pdf`;
      const buf = Buffer.from(await file.arrayBuffer());
      writeFileSync(join(pdfDir(), name), buf);
      pdfFile = name;
    }

    if (!text && !pdfFile) {
      return Response.json({ error: "Нет текста или PDF" }, { status: 400 });
    }

    const updated = appendMessage(id, {
      role: "specialist",
      text: text || (pdfFile ? "Ваш персональный план во вложении." : undefined),
      pdfFile,
    });
    if (!updated) {
      return Response.json({ error: "Не удалось отправить" }, { status: 400 });
    }
    if (pdfFile) {
      updateOrder(id, { status: "plan_sent" });
    } else if (updated.status === "paid") {
      updateOrder(id, { status: "contacted" });
    }
    const fresh = getOrder(id)!;
    void notifyMomPlanTeamReply(fresh, {
      text: text || undefined,
      hasPdf: Boolean(pdfFile),
    }).catch((e) => console.error("[admin plan] mom notify", e));
    return Response.json({ ok: true, order: orderForClient(fresh) });
  }

  let body: { text?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const text = body.text?.trim();
  if (!text || text.length > MAX_TEXT) {
    return Response.json({ error: "Пустое или слишком длинное сообщение" }, { status: 400 });
  }

  const updated = appendMessage(id, { role: "specialist", text });
  if (!updated) {
    return Response.json({ error: "Не удалось отправить" }, { status: 400 });
  }
  if (updated.status === "paid") {
    updateOrder(id, { status: "contacted" });
  }
  const fresh = getOrder(id)!;
  void notifyMomPlanTeamReply(fresh, { text }).catch((e) =>
    console.error("[admin plan] mom notify", e),
  );
  return Response.json({ ok: true, order: orderForClient(fresh) });
}
