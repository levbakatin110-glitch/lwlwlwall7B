import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { readSessionFromRequest } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-auth";
import { getOrder, pdfDir } from "@/lib/orders-store";
import { normalizeEmail } from "@/lib/email-codes";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; file: string }> };

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function GET(req: Request, ctx: Ctx) {
  const { id, file } = await ctx.params;
  const safe = safeName(file);
  const order = getOrder(id);
  if (!order) {
    return Response.json({ error: "Не найдено" }, { status: 404 });
  }

  const allowed =
    order.messages.some((m) => m.pdfFile === safe) ||
    order.aiDraft?.pdfFile === safe;

  if (!allowed) {
    return Response.json({ error: "Файл не найден" }, { status: 404 });
  }

  const isAdmin = requireAdmin(req);
  const session = readSessionFromRequest(req);
  const isOwner =
    session && normalizeEmail(session.email) === normalizeEmail(order.email);

  if (!isAdmin && !isOwner) {
    return Response.json({ error: "Нет доступа" }, { status: 403 });
  }

  const path = join(pdfDir(), safe);
  if (!existsSync(path)) {
    return Response.json({ error: "Файл отсутствует" }, { status: 404 });
  }

  const buf = readFileSync(path);
  return new Response(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safe}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
