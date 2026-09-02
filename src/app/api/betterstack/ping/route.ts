import { adminPasswordOk } from "@/lib/admin-auth";
import { betterStackDsn, betterStackEnabled } from "@/lib/betterstack-sentry";
import { initBetterStackServer } from "@/lib/betterstack-sentry-server";

export const runtime = "nodejs";

/**
 * GET /api/betterstack/ping?key=<ADMIN_PASSWORD>
 * Отправляет тест в Better Stack с сервера (не видно в Network браузера).
 */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!adminPasswordOk(key)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (!betterStackEnabled()) {
    return Response.json({
      ok: false,
      error: "Better Stack выключен: нет DSN или не production",
      hasDsn: Boolean(betterStackDsn()),
    });
  }

  await initBetterStackServer();
  const Sentry = await import("@sentry/node");
  const eventId = Sentry.captureMessage("hey-maya · ручная проверка", "info");
  const flushed = await Sentry.flush(5000);

  return Response.json({
    ok: flushed,
    eventId,
    message: flushed
      ? "Отправлено. Через 1–2 мин открой errors.betterstack.com → hey-maya"
      : "Не удалось отправить (сеть VPS или DSN). Проверь pm2 logs maya",
  });
}
