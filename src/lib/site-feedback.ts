import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { adminTelegramChatId } from "@/lib/admin-notify";
import { getResend, resendFromAddress } from "@/lib/resend";
import { sendMessage } from "@/lib/telegram";

const DATA_DIR = join(process.cwd(), "data");
const LOG_FILE = join(DATA_DIR, "site-feedback.jsonl");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appendLog(row: Record<string, unknown>) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  appendFileSync(LOG_FILE, `${JSON.stringify(row)}\n`, "utf8");
}

export function feedbackNotifyEmail(): string {
  return (
    process.env.FEEDBACK_NOTIFY_EMAIL?.trim() ||
    process.env.ADMIN_NOTIFY_EMAIL?.trim() ||
    "levprogrammist@gmail.com"
  );
}

const RATE_FILE = join(DATA_DIR, "feedback-rate.json");
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

type RateStore = Record<string, number>;

function readRateStore(): RateStore {
  if (!existsSync(RATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(RATE_FILE, "utf8")) as RateStore;
  } catch {
    return {};
  }
}

function writeRateStore(store: RateStore) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const cutoff = Date.now() - RATE_WINDOW_MS;
  const pruned: RateStore = {};
  for (const [k, t] of Object.entries(store)) {
    if (typeof t === "number" && t > cutoff) pruned[k] = t;
  }
  writeFileSync(RATE_FILE, JSON.stringify(pruned), "utf8");
}

export function feedbackRateLimitKey(opts: {
  email?: string;
  ip?: string;
}): string | null {
  const email = opts.email?.trim().toLowerCase();
  if (email) return `e:${email}`;
  const ip = opts.ip?.trim();
  if (ip && ip !== "unknown") return `ip:${ip}`;
  return null;
}

export function checkFeedbackRateLimit(key: string):
  | { ok: true }
  | { ok: false; retryAfterSec: number } {
  const store = readRateStore();
  const last = store[key];
  if (typeof last !== "number") return { ok: true };
  const elapsed = Date.now() - last;
  if (elapsed >= RATE_WINDOW_MS) return { ok: true };
  return {
    ok: false,
    retryAfterSec: Math.ceil((RATE_WINDOW_MS - elapsed) / 1000),
  };
}

export function markFeedbackSent(key: string) {
  const store = readRateStore();
  store[key] = Date.now();
  writeRateStore(store);
}

export function clientIpFromRequest(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

async function sendFeedbackTelegram(opts: {
  message: string;
  fromEmail: string;
  page: string;
  at: string;
}): Promise<boolean> {
  const chatId = adminTelegramChatId();
  if (!chatId) return false;

  const preview = opts.message.length > 900
    ? `${opts.message.slice(0, 900)}…`
    : opts.message;

  const text = [
    "<b>Мая · отзыв с сайта</b>",
    `Почта: ${opts.fromEmail}`,
    `Страница: ${opts.page}`,
    opts.at,
    "",
    preview.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  ].join("\n");

  try {
    await sendMessage(chatId, text);
    return true;
  } catch (e) {
    console.error("[site-feedback] telegram failed", e);
    return false;
  }
}

async function sendFeedbackEmail(opts: {
  message: string;
  fromEmail: string;
  page: string;
  at: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resend = getResend();
  if (!resend) {
    return {
      ok: false,
      error: "RESEND_API_KEY не задан на сервере",
    };
  }

  const to = feedbackNotifyEmail();
  const subject = "Мая · отзыв с сайта";
  const text = [
    "Новый отзыв с hey-maya.ru",
    "",
    `Почта пользователя: ${opts.fromEmail}`,
    `Страница: ${opts.page}`,
    `Время: ${opts.at}`,
    "",
    opts.message,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;padding:20px;color:#1a1a1a">
      <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#c45c7a;margin:0 0 8px">Мая · отзыв</p>
      <p style="margin:0 0 6px"><strong>Почта:</strong> ${escapeHtml(opts.fromEmail)}</p>
      <p style="margin:0 0 6px"><strong>Страница:</strong> ${escapeHtml(opts.page)}</p>
      <p style="margin:0 0 14px;color:#666;font-size:13px">${escapeHtml(opts.at)}</p>
      <div style="padding:14px 16px;border-radius:12px;background:#fdf2f8;line-height:1.55;white-space:pre-wrap">${escapeHtml(opts.message)}</div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: resendFromAddress(),
      to: [to],
      subject,
      html,
      text,
      replyTo: opts.fromEmail.includes("@") ? opts.fromEmail : undefined,
    });
    if (error) {
      console.error("[site-feedback] resend error", error);
      const hint =
        error.message?.includes("testing emails") ||
        error.message?.includes("verify a domain")
          ? " Нужен RESEND_FROM с верифицированным доменом hey-maya.ru в .env.production."
          : "";
      return {
        ok: false,
        error: `${error.message || "Resend отклонил письмо"}.${hint}`,
      };
    }
    console.info("[site-feedback] email sent", { to, id: data?.id });
    return { ok: true };
  } catch (e) {
    console.error("[site-feedback] send failed", e);
    const msg = e instanceof Error ? e.message : "Ошибка Resend";
    return { ok: false, error: msg };
  }
}

export async function sendSiteFeedback(opts: {
  message: string;
  fromEmail?: string;
  page?: string;
  userAgent?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const message = opts.message.trim().slice(0, 2000);
  if (message.length < 4) {
    return { ok: false, error: "Напишите чуть подробнее" };
  }

  const at = new Date().toISOString();
  const fromEmail = opts.fromEmail?.trim() || "не указана";
  const page = opts.page?.trim() || "hey-maya.ru";

  appendLog({
    at,
    message,
    fromEmail,
    page,
    userAgent: opts.userAgent?.slice(0, 240),
  });

  const payload = { message, fromEmail, page, at };
  const [emailResult, telegramOk] = await Promise.all([
    sendFeedbackEmail(payload),
    sendFeedbackTelegram(payload),
  ]);

  if (emailResult.ok || telegramOk) {
    if (!emailResult.ok) {
      console.warn("[site-feedback] email failed, delivered via Telegram", emailResult.error);
    }
    return { ok: true };
  }

  if (!getResend() && !adminTelegramChatId()) {
    return {
      ok: false,
      error:
        "Отправка не настроена на сервере (нет RESEND_API_KEY и Telegram). Сообщение сохранено в лог.",
    };
  }

  const detail = !emailResult.ok ? emailResult.error : "Telegram недоступен";
  return {
    ok: false,
    error: `Не удалось отправить: ${detail}. Проверьте RESEND_FROM и spam.`,
  };
}
