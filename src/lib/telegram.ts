/** Telegram Bot API helpers for Мая · Малыш */

export const MAYA_SITE =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://hey-maya.ru";

export const BOT_DISPLAY_NAME = "Мая · Малыш";

export function botToken(): string | null {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return t || null;
}

export function webhookSecret(): string | null {
  const s = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  return s || null;
}

type TgReplyMarkup = {
  inline_keyboard: { text: string; url?: string; callback_data?: string }[][];
};

export async function tgApi<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = botToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан");

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; description?: string } & T;
  if (!data.ok) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data;
}

export async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: TgReplyMarkup,
) {
  return tgApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export function siteUrl(utm: string) {
  return `${MAYA_SITE}/?utm_source=telegram&utm_medium=bot&utm_campaign=${utm}`;
}

export function welcomeText() {
  return [
    `<b>${BOT_DISPLAY_NAME}</b>`,
    "",
    "Не просто записи — умный помощник по росту, кормлению, сну и режиму ребёнка.",
    "",
    "Открой Маю на сайте ↓",
  ].join("\n");
}

export function siteKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Открыть Маю", url: siteUrl("start") }],
    ],
  };
}

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number; first_name?: string; username?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number };
    message?: { chat: { id: number } };
  };
};
