import { adminPasswordOkLimited } from "@/lib/admin-auth";
import { betterStackDsn, betterStackEnabled } from "@/lib/betterstack-sentry";
import { initBetterStackServer } from "@/lib/betterstack-sentry-server";

export const runtime = "nodejs";

/**
 * GET /api/betterstack/ping с заголовком x-admin-password
 * (curl -H "x-admin-password: …" https://hey-maya.ru/api/betterstack/ping).
 * Отправляет тест в Better Stack с сервера.
 */
export async function GET(req: Request) {
  if (!adminPasswordOkLimited(req, req.headers.get("x-admin-password"))) {
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
  const eventId = Sentry.captureException(
    new Error("hey-maya · тест мониторинга (можно закрыть)"),
  );
  const flushed = await Sentry.flush(5000);

  return Response.json({
    ok: flushed,
    eventId,
    message: flushed
      ? "Ошибка-тест отправлена. Через 1–2 мин → errors.betterstack.com → hey-maya → Issues"
      : "Не удалось отправить (сеть VPS или DSN). Проверь pm2 logs maya",
  });
}
