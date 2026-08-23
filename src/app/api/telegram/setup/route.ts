import { botToken, MAYA_SITE, tgApi, webhookSecret } from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * POST /api/telegram/setup
 * Header: Authorization: Bearer <TELEGRAM_SETUP_KEY>
 * Ставит webhook на https://hey-maya.ru/api/telegram/webhook
 */
export async function POST(req: Request) {
  const setupKey = process.env.TELEGRAM_SETUP_KEY?.trim();
  if (!setupKey) {
    return Response.json(
      { error: "TELEGRAM_SETUP_KEY не задан" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${setupKey}`) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (!botToken()) {
    return Response.json(
      { error: "TELEGRAM_BOT_TOKEN не задан" },
      { status: 503 },
    );
  }

  const site = MAYA_SITE.replace(/\/$/, "");
  const url = `${site}/api/telegram/webhook`;
  const secret = webhookSecret();

  const result = await tgApi<{ result: boolean; description?: string }>(
    "setWebhook",
    {
      url,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
      ...(secret ? { secret_token: secret } : {}),
    },
  );

  const info = await tgApi<{ result: { url?: string } }>("getWebhookInfo", {});

  return Response.json({
    ok: true,
    webhook: url,
    set: result,
    info: info.result,
  });
}

export async function GET(req: Request) {
  const setupKey = process.env.TELEGRAM_SETUP_KEY?.trim();
  const auth = req.headers.get("authorization") || "";
  if (!setupKey || auth !== `Bearer ${setupKey}`) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (!botToken()) {
    return Response.json({ error: "no token" }, { status: 503 });
  }
  const info = await tgApi<{ result: unknown }>("getWebhookInfo", {});
  return Response.json(info.result);
}
