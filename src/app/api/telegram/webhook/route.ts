import {
  sendMessage,
  siteKeyboard,
  tgApi,
  type TelegramUpdate,
  webhookSecret,
  welcomeText,
  botToken,
} from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!botToken()) {
    return Response.json({ error: "bot not configured" }, { status: 503 });
  }

  const secret = webhookSecret();
  if (secret) {
    const header = req.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  try {
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const cmd = text.split(/\s+/)[0]?.toLowerCase().split("@")[0] ?? "";

      if (cmd === "/start" || cmd === "/help") {
        await sendMessage(chatId, welcomeText(), siteKeyboard());
      } else if (cmd === "/site" || cmd === "/maya") {
        await sendMessage(
          chatId,
          "Мая на сайте ↓",
          siteKeyboard(),
        );
      } else {
        await sendMessage(
          chatId,
          "Нажми /start или кнопку ниже — откроется Мая.",
          siteKeyboard(),
        );
      }
    }

    if (update.callback_query?.id) {
      await tgApi("answerCallbackQuery", {
        callback_query_id: update.callback_query.id,
      });
    }
  } catch (e) {
    console.error("[telegram webhook]", e);
  }

  // Telegram ждёт быстрый 200
  return Response.json({ ok: true });
}
