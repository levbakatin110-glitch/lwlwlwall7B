import { createHmac, timingSafeEqual } from "crypto";
import { normalizeEmail } from "@/lib/email-codes";

const COOKIE = "maya_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 180; // ~6 месяцев

function authSecret(): string {
  const fromEnv =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?.trim() ||
    process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
    process.env.ANALYTICS_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[maya] AUTH_SECRET не задан. Добавьте в .env на VPS и перезапустите.",
    );
  }
  return "maya-dev-oauth-secret-change-me";
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function sign(payload: string): string {
  return b64url(
    createHmac("sha256", authSecret()).update(payload).digest(),
  );
}

export function createSessionToken(email: string): string {
  const payload = b64url(
    JSON.stringify({
      e: normalizeEmail(email),
      exp: Date.now() + MAX_AGE_SEC * 1000,
    }),
  );
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(
  token: string | null | undefined,
): { email: string } | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(fromB64url(payload).toString("utf8")) as {
      e?: string;
      exp?: number;
    };
    if (!data.e || typeof data.exp !== "number") return null;
    if (Date.now() > data.exp) return null;
    return { email: normalizeEmail(data.e) };
  } catch {
    return null;
  }
}

export function readSessionFromRequest(req: Request): { email: string } | null {
  const raw = req.headers.get("cookie") || "";
  const match = raw.match(/(?:^|;\s*)maya_session=([^;]*)/);
  if (!match?.[1]) return null;
  try {
    return verifySessionToken(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function sessionCookieSecure(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    (process.env.NEXT_PUBLIC_SITE_URL || "").startsWith("https")
  );
}

export function sessionSetCookie(email: string): string {
  const token = createSessionToken(email);
  const secure = sessionCookieSecure();
  return [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SEC}`,
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function sessionClearCookie(): string {
  const secure = sessionCookieSecure();
  return [
    `${COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export { COOKIE as SESSION_COOKIE_NAME };
