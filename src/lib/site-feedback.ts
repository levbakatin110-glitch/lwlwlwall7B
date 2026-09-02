import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getResend, resendFromAddress } from "@/lib/resend";

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

  const resend = getResend();
  if (!resend) {
    console.warn("[site-feedback] RESEND_API_KEY не задан — письмо не отправлено");
    return {
      ok: false,
      error: "Отправка временно недоступна. Попробуйте позже.",
    };
  }

  const to = feedbackNotifyEmail();
  const subject = "Мая · отзыв с сайта";
  const text = [
    "Новый отзыв с hey-maya.ru",
    "",
    `Почта пользователя: ${fromEmail}`,
    `Страница: ${page}`,
    `Время: ${at}`,
    "",
    message,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;padding:20px;color:#1a1a1a">
      <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#c45c7a;margin:0 0 8px">Мая · отзыв</p>
      <p style="margin:0 0 6px"><strong>Почта:</strong> ${escapeHtml(fromEmail)}</p>
      <p style="margin:0 0 6px"><strong>Страница:</strong> ${escapeHtml(page)}</p>
      <p style="margin:0 0 14px;color:#666;font-size:13px">${escapeHtml(at)}</p>
      <div style="padding:14px 16px;border-radius:12px;background:#fdf2f8;line-height:1.55;white-space:pre-wrap">${escapeHtml(message)}</div>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: resendFromAddress(),
      to,
      subject,
      html,
      text,
    });
    if (error) {
      console.error("[site-feedback] resend error", error);
      return { ok: false, error: "Не удалось отправить. Попробуйте позже." };
    }
    return { ok: true };
  } catch (e) {
    console.error("[site-feedback] send failed", e);
    return { ok: false, error: "Не удалось отправить. Попробуйте позже." };
  }
}
