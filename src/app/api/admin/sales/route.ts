import { requireAdmin } from "@/lib/admin-auth";
import { getSalesReport } from "@/lib/sales-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нужен пароль админки" }, { status: 401 });
  }
  try {
    return Response.json(getSalesReport());
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Не удалось собрать продажи" },
      { status: 500 },
    );
  }
}
