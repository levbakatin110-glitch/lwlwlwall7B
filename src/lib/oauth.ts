import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { isValidEmail, normalizeEmail } from "@/lib/email-codes";

export type OAuthProvider = "google" | "yandex";

type OAuthTicket = {
  email: string;
  expiresAt: number;
};

const g = globalThis as typeof globalThis & {
  __mayaOAuthTickets?: Map<string, OAuthTicket>;
};

function tickets() {
  if (!g.__mayaOAuthTickets) g.__mayaOAuthTickets = new Map();
  return g.__mayaOAuthTickets;
}

function authSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
    process.env.ANALYTICS_PASSWORD?.trim() ||
    "maya-dev-oauth-secret-change-me"
  );
}

export function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function oauthCallbackUrl(provider: OAuthProvider): string {
  return `${siteOrigin()}/api/auth/oauth/${provider}/callback`;
}

export function providerConfigured(provider: OAuthProvider): boolean {
  if (provider === "google") {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CLIENT_SECRET?.trim(),
    );
  }
  return Boolean(
    process.env.YANDEX_CLIENT_ID?.trim() &&
      process.env.YANDEX_CLIENT_SECRET?.trim(),
  );
}

export function providersStatus(): Record<OAuthProvider, boolean> {
  return {
    google: providerConfigured("google"),
    yandex: providerConfigured("yandex"),
  };
}

function b64url(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", authSecret()).update(payload).digest());
}

export type OAuthStatePayload = {
  p: OAuthProvider;
  m: "login" | "register";
  r: string;
  t: number;
  n: string;
};

export function createOAuthState(input: {
  provider: OAuthProvider;
  mode: "login" | "register";
  returnTo: string;
}): string {
  const payload: OAuthStatePayload = {
    p: input.provider,
    m: input.mode,
    r: input.returnTo,
    t: Date.now(),
    n: randomBytes(12).toString("hex"),
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function parseOAuthState(
  state: string,
): { ok: true; data: OAuthStatePayload } | { ok: false; error: string } {
  const [body, sig] = state.split(".");
  if (!body || !sig) return { ok: false, error: "Некорректный state" };
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Некорректный state" };
    }
  } catch {
    return { ok: false, error: "Некорректный state" };
  }
  try {
    const data = JSON.parse(fromB64url(body).toString("utf8")) as OAuthStatePayload;
    if (data.p !== "google" && data.p !== "yandex") {
      return { ok: false, error: "Неизвестный провайдер" };
    }
    if (Date.now() - data.t > 15 * 60_000) {
      return { ok: false, error: "Сессия входа устарела — попробуйте снова" };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Некорректный state" };
  }
}

export function createOAuthTicket(email: string): string {
  const key = randomBytes(24).toString("hex");
  tickets().set(key, {
    email: normalizeEmail(email),
    expiresAt: Date.now() + 5 * 60_000,
  });
  return key;
}

export function consumeOAuthTicket(
  ticket: string,
): { ok: true; email: string } | { ok: false; error: string } {
  const entry = tickets().get(ticket);
  if (!entry) {
    return { ok: false, error: "Ссылка входа недействительна — войдите снова" };
  }
  tickets().delete(ticket);
  if (Date.now() > entry.expiresAt) {
    return { ok: false, error: "Ссылка входа устарела — войдите снова" };
  }
  if (!isValidEmail(entry.email)) {
    return { ok: false, error: "Провайдер не вернул почту" };
  }
  return { ok: true, email: entry.email };
}

export function googleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthCallbackUrl("google"),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function yandexAuthUrl(state: string): string {
  const clientId = process.env.YANDEX_CLIENT_ID!.trim();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: oauthCallbackUrl("yandex"),
    force_confirm: "yes",
    scope: "login:email login:info",
    state,
  });
  return `https://oauth.yandex.ru/authorize?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    redirect_uri: oauthCallbackUrl("google"),
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      tokenData.error_description ||
        tokenData.error ||
        "Не удалось получить токен Google",
    );
  }
  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const info = (await infoRes.json()) as {
    email?: string;
    email_verified?: boolean;
    error?: string;
  };
  if (!infoRes.ok || !info.email) {
    throw new Error("Google не вернул email");
  }
  if (info.email_verified === false) {
    throw new Error("Email в Google не подтверждён");
  }
  return normalizeEmail(info.email);
}

export async function exchangeYandexCode(code: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.YANDEX_CLIENT_ID!.trim(),
    client_secret: process.env.YANDEX_CLIENT_SECRET!.trim(),
  });
  const tokenRes = await fetch("https://oauth.yandex.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      tokenData.error_description ||
        tokenData.error ||
        "Не удалось получить токен Яндекс",
    );
  }
  const infoRes = await fetch("https://login.yandex.ru/info?format=json", {
    headers: { Authorization: `OAuth ${tokenData.access_token}` },
  });
  const info = (await infoRes.json()) as {
    default_email?: string;
    emails?: string[];
    error?: string;
  };
  if (!infoRes.ok) {
    throw new Error("Яндекс не вернул профиль");
  }
  const email = normalizeEmail(
    info.default_email || info.emails?.[0] || "",
  );
  if (!isValidEmail(email)) {
    throw new Error(
      "В Яндекс ID нет email. Добавьте почту в аккаунте Яндекса или войдите по коду.",
    );
  }
  return email;
}

export function safeReturnTo(raw: string | null | undefined): string {
  const v = (raw || "/register").trim();
  if (!v.startsWith("/") || v.startsWith("//")) return "/register";
  if (v.includes("://")) return "/register";
  return v.slice(0, 200);
}
