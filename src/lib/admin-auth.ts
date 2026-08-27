import { timingSafeEqual } from "crypto";

const COOKIE = "maya_admin";
const MAX_AGE_SEC = 60 * 60 * 12;

export function adminPassword(): string {
  return (
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.ANALYTICS_PASSWORD?.trim() ||
    "maya-stats"
  );
}

export function adminPasswordOk(password: string | null | undefined): boolean {
  const expected = adminPassword();
  if (!password || !expected) return false;
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return password === expected;
  }
}

export function readAdminFromRequest(req: Request): boolean {
  const header = req.headers.get("x-admin-password");
  if (adminPasswordOk(header)) return true;
  const raw = req.headers.get("cookie") || "";
  const match = raw.match(/(?:^|;\s*)maya_admin=([^;]*)/);
  if (!match?.[1]) return false;
  try {
    return decodeURIComponent(match[1]) === "1" && Boolean(raw);
  } catch {
    return false;
  }
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
 * Cookie — только чтобы UI помнил «уже вошли» и подставлял пароль из sessionStorage.
 */
export function requireAdmin(req: Request): boolean {
  return adminPasswordOk(req.headers.get("x-admin-password"));
}
