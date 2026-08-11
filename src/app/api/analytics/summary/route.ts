import {
  analyticsPasswordOk,
  clearAnalytics,
  getAnalyticsSummary,
} from "@/lib/analytics-store";

export const runtime = "nodejs";

function passwordFrom(req: Request): string | null {
  return (
    req.headers.get("x-analytics-password") ||
    new URL(req.url).searchParams.get("password")
  );
}

export async function GET(req: Request) {
  if (!analyticsPasswordOk(passwordFrom(req))) {
    return Response.json({ error: "Нужен пароль" }, { status: 401 });
  }
  const days = Number(new URL(req.url).searchParams.get("days") || "14");
  return Response.json(getAnalyticsSummary(Number.isFinite(days) ? days : 14));
}

export async function DELETE(req: Request) {
  if (!analyticsPasswordOk(passwordFrom(req))) {
    return Response.json({ error: "Нужен пароль" }, { status: 401 });
  }
  clearAnalytics();
  return Response.json({ ok: true });
}
