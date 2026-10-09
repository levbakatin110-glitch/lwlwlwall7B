import { adminPasswordOk, adminPasswordOkLimited } from "@/lib/admin-auth";
import {
  analyticsPasswordOk,
  clearAnalytics,
  getAnalyticsSummary,
} from "@/lib/analytics-store";

export const runtime = "nodejs";

function authOk(req: Request): boolean {
  return adminPasswordOkLimited(
    req,
    req.headers.get("x-analytics-password") ||
      req.headers.get("x-admin-password"),
    (p) => analyticsPasswordOk(p) || adminPasswordOk(p),
  );
}

export async function GET(req: Request) {
  if (!authOk(req)) {
    return Response.json({ error: "Нужен пароль" }, { status: 401 });
  }
  const days = Number(new URL(req.url).searchParams.get("days") || "14");
  return Response.json(getAnalyticsSummary(Number.isFinite(days) ? days : 14));
}

export async function DELETE(req: Request) {
  if (!authOk(req)) {
    return Response.json({ error: "Нужен пароль" }, { status: 401 });
  }
  clearAnalytics();
  return Response.json({ ok: true });
}
