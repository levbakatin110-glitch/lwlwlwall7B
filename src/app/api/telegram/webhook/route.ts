import {
  botToken,
  siteKeyboard,
  welcomeText,
  webhookSecret,
  type TelegramUpdate,
} from "@/lib/telegram";

export const runtime = "nodejs";

/** Ответ Telegram прямо в HTTP-ответе webhook — без исходящего запроса с VPS. */
function tgMethodResponse(method: string, params: Record<string, unknown>) {
  return Response.json({ method, ...params });
}

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
    if (update.callback_query?.id) {
      return tgMethodResponse("answerCallbackQuery", {
        callback_query_id: update.callback_query.id,
      });
    }

    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const cmd = text.split(/\s+/)[0]?.toLowerCase().split("@")[0] ?? "";

      let reply = "Нажми /start или кнопку ниже — откроется Мая.";
      if (cmd === "/start" || cmd === "/help") {
        reply = welcomeText();
      } else if (cmd === "/site" || cmd === "/maya") {
        reply = "Мая на сайте ↓";
      }

      return tgMethodResponse("sendMessage", {
        chat_id: chatId,
        text: reply,
        parse_mode: "HTML",
        disable_web_page_preview: false,
        reply_markup: siteKeyboard(),
      });
    }
  } catch (e) {
    console.error("[telegram webhook]", e);
  }

  return Response.json({ ok: true });
}
