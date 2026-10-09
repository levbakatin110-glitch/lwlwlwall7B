import { timingSafeEqual } from "crypto";
import { hitRateLimit, rateLimitExceeded, requestIp } from "@/lib/rate-limit";

const COOKIE = "maya_admin";
const MAX_AGE_SEC = 60 * 60 * 12;
const FAIL_LIMIT = 10;
const FAIL_WINDOW_SEC = 15 * 60;

/** Без ADMIN_PASSWORD/ANALYTICS_PASSWORD в env админка закрыта. */
export function adminPassword(): string {
  return (
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.ANALYTICS_PASSWORD?.trim() ||
    ""
  );
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function adminPasswordOk(password: string | null | undefined): boolean {
  const expected = adminPassword();
  if (!password || !expected) return false;
  return safeEqual(password, expected);
}

/** Проверка пароля с лимитом неудачных попыток по IP. */
export function adminPasswordOkLimited(
  req: Request,
  password: string | null | undefined,
  check: (p: string | null | undefined) => boolean = adminPasswordOk,
): boolean {
  const key = `admin-fail:${requestIp(req)}`;
  if (rateLimitExceeded(key, FAIL_LIMIT, FAIL_WINDOW_SEC)) return false;
  if (check(password)) return true;
  if (password) hitRateLimit(key, FAIL_LIMIT, FAIL_WINDOW_SEC);
  return false;
}

/** Cookie после успешного входа в админку (флаг; пароль проверяем при login). */
export function adminSetCookie(): string {
  const secure =
    process.env.NODE_ENV === "production" ||
    (process.env.NEXT_PUBLIC_SITE_URL || "").startsWith("https");
  return [
    `${COOKIE}=1`,
    "Path=/",
    `Max-Age=${MAX_AGE_SEC}`,
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function adminClearCookie(): string {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

/**
 * Админ-cookie сама по себе слабая (просто флаг).
 * Для API требуем либо свежий x-admin-password, либо cookie + тот же пароль в sessionStorage на клиенте.
 * Практика: ops-log и admin login ставят cookie после проверки пароля; API принимают
 * x-admin-password ИЛИ cookie maya_admin=1 вместе с x-admin-password на критичных DELETE.
 *
 * Упростим: любая операция админки требует заголовок x-admin-password.
 * Cookie, только чтобы UI помнил «уже вошли» и подставлял пароль из sessionStorage.
 */
export function requireAdmin(req: Request): boolean {
  return adminPasswordOkLimited(req, req.headers.get("x-admin-password"));
}
