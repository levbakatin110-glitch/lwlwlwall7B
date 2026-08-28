import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { MAYA_SITE } from "@/lib/telegram";
import { getResend, resendFromAddress } from "@/lib/resend";
import { sendMessage } from "@/lib/telegram";
import { PLAN_TOPIC_LABEL } from "@/lib/plan-products";
import type { PlanOrder } from "@/lib/orders-store";

const DATA_DIR = join(process.cwd(), "data");
const TG_FILE = join(DATA_DIR, "admin-telegram.json");

type TgStore = { chatId?: number; username?: string; linkedAt?: string };

function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readTgStore(): TgStore {
  ensure();
  if (!existsSync(TG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(TG_FILE, "utf8")) as TgStore;
  } catch {
    return {};
  }
}

export function saveAdminTelegramChat(chatId: number, username?: string) {
  ensure();
  writeFileSync(
    TG_FILE,
    JSON.stringify({
      chatId,
      username: username?.replace(/^@/, "").toLowerCase(),
      linkedAt: new Date().toISOString(),
    }),
    "utf8",
  );
}

export function adminTelegramChatId(): number | null {
  const fromEnv = process.env.ADMIN_TELEGRAM_CHAT_ID?.trim();
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isFinite(n)) return n;
  }
  const stored = readTgStore().chatId;
  return stored ?? null;
}

export function adminNotifyEmail(): string {
  return (
    process.env.ADMIN_NOTIFY_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_LEGAL_SUPPORT_EMAIL?.trim() ||
    "levprogrammist@gmail.com"
  );
}

export function adminTelegramUsername(): string {
  return (
    process.env.ADMIN_TELEGRAM_USERNAME?.trim().replace(/^@/, "") ||
    "tarabaner"
  );
}

export function isAdminTelegramUser(username?: string): boolean {
  if (!username) return false;
  return username.replace(/^@/, "").toLowerCase() === adminTelegramUsername().toLowerCase();
}

async function sendAdminEmail(subject: string, html: string, text: string) {
  const resend = getResend();
  if (!resend) {
    console.warn("[admin-notify] RESEND_API_KEY не задан — письмо не отправлено");
    return;
  }
  const to = adminNotifyEmail();
  try {
    await resend.emails.send({
      from: resendFromAddress(),
      to,
      subject,
      html,
      text,
    });
  } catch (e) {
    console.error("[admin-notify] email failed", e);
  }
}

async function sendAdminTelegram(text: string) {
  const chatId = adminTelegramChatId();
  if (!chatId) {
    console.warn(
      "[admin-notify] Telegram chat_id не задан. Напишите боту /notify",
    );
    return;
  }
  try {
    await sendMessage(chatId, text);
  } catch (e) {
    console.error("[admin-notify] telegram failed", e);
  }
}

function orderAdminUrl(orderId: string) {
  return `${MAYA_SITE}/admin/orders?pick=${encodeURIComponent(orderId)}`;
}

export async function notifyNewPlanOrder(order: PlanOrder) {
  const topic = PLAN_TOPIC_LABEL[order.topic];
  const url = orderAdminUrl(order.id);
  const subject = `Мая · новый заказ · ${topic} · ${order.priceRub} ₽`;
  const text = [
    `Новый заказ: ${topic}`,
    `Сумма: ${order.priceRub} ₽`,
    `Почта: ${order.email}`,
    order.childName ? `Малыш: ${order.childName}` : "",
    `Записей в дневнике: ${order.diarySnapshot?.entries.length ?? 0}`,
    url,
  ]
    .filter(Boolean)
    .join("\n");

  await Promise.all([
    sendAdminEmail(
      subject,
      `<p><b>Новый заказ</b> · ${topic} · ${order.priceRub} ₽</p>
       <p>${order.email}${order.childName ? ` · ${order.childName}` : ""}</p>
       <p>Записей: ${order.diarySnapshot?.entries.length ?? 0}</p>
       <p><a href="${url}">Открыть в админке</a></p>`,
      text,
    ),
    sendAdminTelegram(
      `<b>Новый заказ</b> · ${topic} · ${order.priceRub} ₽\n` +
        `${order.email}\n` +
        `Записей: ${order.diarySnapshot?.entries.length ?? 0}\n` +
        `<a href="${url}">Админка</a>`,
    ),
  ]);
}

export async function notifyPlanOrderMessage(order: PlanOrder, fromUser: boolean) {
  if (!fromUser) return;
  const topic = PLAN_TOPIC_LABEL[order.topic];
  const url = orderAdminUrl(order.id);
  const subject = `Мая · ответ мамы · ${topic}`;
  const text = `Мама ответила в заказе (${topic}): ${order.email}\n${url}`;

  await Promise.all([
    sendAdminEmail(
      subject,
      `<p>Мама ответила в заказе <b>${topic}</b></p><p>${order.email}</p><p><a href="${url}">Открыть</a></p>`,
      text,
    ),
    sendAdminTelegram(
      `<b>Ответ мамы</b> · ${topic}\n${order.email}\n<a href="${url}">Админка</a>`,
    ),
  ]);
}
