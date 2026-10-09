import { adminPasswordOk, adminPasswordOkLimited } from "@/lib/admin-auth";
import { analyticsPasswordOk } from "@/lib/analytics-store";
import { getLiveLoadReport } from "@/lib/live-load";

export const runtime = "nodejs";

function liveAuthOk(req: Request): boolean {
  const pass =
    req.headers.get("x-admin-password") ||
    req.headers.get("x-analytics-password");
  return adminPasswordOkLimited(
    req,
    pass,
    (p) => adminPasswordOk(p) || analyticsPasswordOk(p),
  );
}

export async function GET(req: Request) {
  if (!liveAuthOk(req)) {
    return Response.json({ error: "Нужен пароль админки" }, { status: 401 });
  }
  try {
    return Response.json(getLiveLoadReport());
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Не удалось снять снимок" },
      { status: 500 },
    );
  }
}
