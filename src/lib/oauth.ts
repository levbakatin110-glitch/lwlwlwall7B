import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import {
  isAllowedRussianEmail,
  isValidEmail,
  normalizeEmail,
  RUSSIAN_EMAIL_HINT,
} from "@/lib/email-codes";

export type OAuthProvider = "mailru";

type OAuthTicket = {
  email: string;
  expiresAt: number;
};

type PkceSession = {
  provider: OAuthProvider;
  verifier: string;
  deviceId: string;
  expiresAt: number;
};

const g = globalThis as typeof globalThis & {
  __mayaOAuthTickets?: Map<string, OAuthTicket>;
  __mayaOAuthPkce?: Map<string, PkceSession>;
};

function tickets() {
  if (!g.__mayaOAuthTickets) g.__mayaOAuthTickets = new Map();
  return g.__mayaOAuthTickets;
}

function pkceStore() {
  if (!g.__mayaOAuthPkce) g.__mayaOAuthPkce = new Map();
  return g.__mayaOAuthPkce;
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
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.MAILRU_REDIRECT_URI?.trim() ||
    "";
  let origin = raw.replace(/\/$/, "");
  // Публичный домен — никогда не отдаём IP:3000 (браузер ломается на https://IP)
  if (
    !origin ||
    /194\.67\.101\.192/.test(origin) ||
    /:3000\b/.test(origin) ||
    origin.startsWith("http://localhost")
  ) {
    origin = "https://hey-maya.ru";
  }
  try {
    const u = new URL(origin);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://hey-maya.ru";
  }
}

export function oauthCallbackUrl(provider: OAuthProvider): string {
  if (provider === "mailru") {
    const custom = process.env.MAILRU_REDIRECT_URI?.trim();
    if (custom) return custom;
    // Mail.ru в доках требует URI со «/» на конце
    return `${siteOrigin()}/api/auth/oauth/mailru/callback/`;
  }
  return `${siteOrigin()}/api/auth/oauth/${provider}/callback`;
}

export function providerConfigured(provider: OAuthProvider): boolean {
  if (provider === "mailru") {
    return Boolean(
      process.env.MAILRU_CLIENT_ID?.trim() &&
        process.env.MAILRU_CLIENT_SECRET?.trim(),
    );
  }
  return false;
}

export function providersStatus(): {
  mailru: boolean;
  /** Точный redirect_uri, который уходит в Mail.ru — скопируй в кабинет 1:1 */
  mailruRedirectUri: string;
} {
  return {
    mailru: providerConfigured("mailru"),
    mailruRedirectUri: oauthCallbackUrl("mailru"),
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

function pkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
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
}): { state: string; nonce: string } {
  const nonce = randomBytes(12).toString("hex");
  const payload: OAuthStatePayload = {
    p: input.provider,
    m: input.mode,
    r: input.returnTo,
    t: Date.now(),
    n: nonce,
  };
  const body = b64url(JSON.stringify(payload));
  return { state: `${body}.${sign(body)}`, nonce };
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
    const data = JSON.parse(
      fromB64url(body).toString("utf8"),
    ) as OAuthStatePayload;
    if (data.p !== "mailru") {
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

export function savePkceSession(
  nonce: string,
  provider: OAuthProvider,
): { verifier: string; challenge: string; deviceId: string } {
  const verifier = pkceVerifier();
  const deviceId = randomBytes(16).toString("hex");
  pkceStore().set(nonce, {
    provider,
    verifier,
    deviceId,
    expiresAt: Date.now() + 15 * 60_000,
  });
  return { verifier, challenge: pkceChallenge(verifier), deviceId };
}

export function takePkceSession(
  nonce: string,
  provider: OAuthProvider,
): { ok: true; verifier: string; deviceId: string } | { ok: false; error: string } {
  const entry = pkceStore().get(nonce);
  if (!entry) {
    return { ok: false, error: "Сессия входа не найдена — начните снова" };
  }
  pkceStore().delete(nonce);
  if (entry.provider !== provider) {
    return { ok: false, error: "Некорректная сессия входа" };
  }
  if (Date.now() > entry.expiresAt) {
    return { ok: false, error: "Сессия входа устарела — попробуйте снова" };
  }
  return { ok: true, verifier: entry.verifier, deviceId: entry.deviceId };
}

function assertRussianEmail(email: string): string {
  const n = normalizeEmail(email);
  if (!isValidEmail(n)) {
    throw new Error("Провайдер не вернул почту");
  }
  if (!isAllowedRussianEmail(n)) {
    throw new Error(RUSSIAN_EMAIL_HINT);
  }
  return n;
}

export function createOAuthTicket(email: string): string {
  const key = randomBytes(24).toString("hex");
  tickets().set(key, {
    email: assertRussianEmail(email),
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
  if (!isAllowedRussianEmail(entry.email)) {
    return { ok: false, error: RUSSIAN_EMAIL_HINT };
  }
  return { ok: true, email: entry.email };
}

export function buildAuthUrl(
  provider: OAuthProvider,
  state: string,
  challenge: string,
  _deviceId: string,
): string {
  const clientId = process.env.MAILRU_CLIENT_ID!.trim();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: oauthCallbackUrl(provider),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "openid email profile",
  });
  return `https://oauth.mail.ru/login?${params}`;
}

export async function exchangeMailruCode(input: {
  code: string;
  verifier: string;
}): Promise<string> {
  const clientId = process.env.MAILRU_CLIENT_ID!.trim();
  const clientSecret = process.env.MAILRU_CLIENT_SECRET!.trim();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: input.verifier,
    redirect_uri: oauthCallbackUrl("mailru"),
  });
  const tokenRes = await fetch("https://oauth.mail.ru/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
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
        "Не удалось получить токен Mail.ru",
    );
  }

  const infoRes = await fetch("https://oauth.mail.ru/api/v1/oidc/userinfo", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const info = (await infoRes.json()) as {
    email?: string;
    error?: string;
  };
  if (!infoRes.ok || !info.email) {
    throw new Error("Mail.ru не вернул email");
  }
  return assertRussianEmail(info.email);
}

export function safeReturnTo(raw: string | null | undefined): string {
  const v = (raw || "/register").trim();
  if (!v.startsWith("/") || v.startsWith("//")) return "/register";
  if (v.includes("://")) return "/register";
  return v.slice(0, 200);
}
