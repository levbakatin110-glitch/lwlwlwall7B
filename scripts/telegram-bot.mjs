/**
 * Мая · Малыш — long polling бот (как «просто код», без Cloudflare).
 * Сервер сам ходит в Telegram getUpdates — входящий webhook не нужен.
 *
 * ⚠️ НЕ запускай вместе с webhook на hey-maya.ru — polling вызывает deleteWebhook
 *    и ломает /notify для заказов. На VPS используй только webhook (maya pm2).
 *
 * Запуск: pm2 start scripts/telegram-bot.mjs --name maya-bot
 * Нужен TELEGRAM_BOT_TOKEN в окружении / .env
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile() {
  for (const name of [".env", ".env.local"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] == null) process.env[key] = val;
    }
  }
}

loadEnvFile();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://hey-maya.ru"
).replace(/\/$/, "");
const API =
  (process.env.TELEGRAM_API_ROOT || "https://api.telegram.org").replace(
    /\/$/,
    "",
  );

if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN не задан");
  process.exit(1);
}

const NAME = "Мая · Малыш";

function siteUrl(utm) {
  return `${SITE}/?utm_source=telegram&utm_medium=bot&utm_campaign=${utm}`;
}

function welcomeText() {
  return [
    `<b>${NAME}</b>`,
    "",
    "Не просто записи — умный помощник по росту, кормлению, сну и режиму ребёнка.",
    "",
    "Открой Маю на сайте ↓",
  ].join("\n");
}

function siteKeyboard() {
  return {
    inline_keyboard: [[{ text: "Открыть Маю", url: siteUrl("start") }]],
  };
}

async function tg(method, body = {}) {
  const res = await fetch(`${API}/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || `${method} failed`);
  }
  return data.result;
}

async function sendMessage(chatId, text) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
    reply_markup: siteKeyboard(),
  });
}

async function handleUpdate(u) {
  if (u.callback_query?.id) {
    await tg("answerCallbackQuery", {
      callback_query_id: u.callback_query.id,
    });
    return;
  }
  const msg = u.message;
  if (!msg?.text) return;
  const chatId = msg.chat.id;
  const cmd = msg.text.trim().split(/\s+/)[0].toLowerCase().split("@")[0];
  let text =
    "Нажми /start или кнопку ниже — откроется Мая.";
  if (cmd === "/start" || cmd === "/help") text = welcomeText();
  else if (cmd === "/site" || cmd === "/maya") text = "Мая на сайте ↓";
  await sendMessage(chatId, text);
}

async function main() {
  console.log("[maya-bot] long polling… API=", API);
  try {
    await tg("deleteWebhook", { drop_pending_updates: false });
    console.log("[maya-bot] webhook снят — работаем через getUpdates");
  } catch (e) {
    console.warn("[maya-bot] deleteWebhook:", e.message);
  }

  let offset = 0;
  for (;;) {
    try {
      const updates = await tg("getUpdates", {
        offset,
        timeout: 50,
        allowed_updates: ["message", "callback_query"],
      });
      for (const u of updates) {
        offset = u.update_id + 1;
        try {
          await handleUpdate(u);
        } catch (e) {
          console.error("[maya-bot] handle:", e.message);
        }
      }
    } catch (e) {
      console.error("[maya-bot] poll error:", e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main();
