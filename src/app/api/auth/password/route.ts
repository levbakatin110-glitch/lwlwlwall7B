import {
  hasPassword,
  passwordLooksOk,
  setAccountPassword,
  verifyAccountPassword,
} from "@/lib/accounts";
import {
  isAllowedRussianEmail,
  isValidEmail,
  normalizeEmail,
  RUSSIAN_EMAIL_HINT,
  verifyEmailCode,
} from "@/lib/email-codes";
import {
  CONSENT_REQUIRED_ERROR,
  hasPdConsent,
  recordRegistrationConsents,
} from "@/lib/consent-store";
import {
  hitRateLimit,
  hitRateLimits,
  requestIp,
  tooManyRequests,
} from "@/lib/rate-limit";
import { readSessionFromRequest, sessionSetCookie } from "@/lib/session";

export const runtime = "nodejs";

/** Есть ли пароль у этой почты */
export async function GET(req: Request) {
  const limit = hitRateLimit(`has-password:ip:${requestIp(req)}`, 60, 3600);
  if (!limit.ok) return tooManyRequests(limit);
  const email = normalizeEmail(
    new URL(req.url).searchParams.get("email") || "",
  );
  if (!isValidEmail(email)) {
    return Response.json({ hasPassword: false });
  }
  return Response.json({ hasPassword: hasPassword(email) });
}

/**
 * POST { action }
 * - login: email + password → сессия
 * - set: сессия или email+code, + password
 */
export async function POST(req: Request) {
  let body: {
    action?: string;
    email?: string;
    password?: string;
    code?: string;
    consents?: { pd?: boolean; marketing?: boolean };
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const action = String(body.action || "");
  const password = String(body.password || "");
  const email = normalizeEmail(body.email || "");

  if (action === "login") {
    if (!isValidEmail(email)) {
      return Response.json({ error: "Укажите почту" }, { status: 400 });
    }
    if (!isAllowedRussianEmail(email)) {
      return Response.json({ error: RUSSIAN_EMAIL_HINT }, { status: 400 });
    }
    const limit = hitRateLimits([
      { key: `pw-login:email:${email}`, limit: 10, windowSec: 900 },
      { key: `pw-login:ip:${requestIp(req)}`, limit: 30, windowSec: 900 },
    ]);
    if (!limit.ok) return tooManyRequests(limit);
    if (!verifyAccountPassword(email, password)) {
      return Response.json(
        { error: "Неверный пароль. Можно войти по коду из письма." },
        { status: 401 },
      );
    }
    if (body.consents?.pd === true) {
      recordRegistrationConsents({
        email,
        marketing: body.consents?.marketing === true,
        ip: requestIp(req),
        userAgent: req.headers.get("user-agent") || "",
      });
    } else if (!hasPdConsent(email)) {
      return Response.json(CONSENT_REQUIRED_ERROR, { status: 403 });
    }
    return Response.json(
      { ok: true, email },
      { headers: { "Set-Cookie": sessionSetCookie(email) } },
    );
  }

  if (action === "set" || action === "reset") {
    if (!passwordLooksOk(password)) {
      return Response.json(
        { error: "Пароль, от 6 символов" },
        { status: 400 },
      );
    }
    const session = readSessionFromRequest(req);
    let target = session?.email || "";
    if (!target) {
      if (!isValidEmail(email) || !isAllowedRussianEmail(email)) {
        return Response.json({ error: "Нужна почта" }, { status: 400 });
      }
      const limit = hitRateLimits([
        { key: `verify-code:email:${email}`, limit: 10, windowSec: 900 },
        { key: `verify-code:ip:${requestIp(req)}`, limit: 30, windowSec: 900 },
      ]);
      if (!limit.ok) return tooManyRequests(limit);
      const givesPd = body.consents?.pd === true;
      if (!givesPd && !hasPdConsent(email)) {
        return Response.json(CONSENT_REQUIRED_ERROR, { status: 403 });
      }
      const code = String(body.code || "").trim();
      const checked = verifyEmailCode(email, code);
      if (!checked.ok) {
        return Response.json({ error: checked.error }, { status: 400 });
      }
      if (givesPd) {
        recordRegistrationConsents({
          email,
          marketing: body.consents?.marketing === true,
          ip: requestIp(req),
          userAgent: req.headers.get("user-agent") || "",
        });
      }
      target = email;
    }
    const saved = setAccountPassword(target, password);
    if (!saved.ok) {
      return Response.json({ error: saved.error }, { status: 400 });
    }
    return Response.json(
      { ok: true, email: target },
      { headers: { "Set-Cookie": sessionSetCookie(target) } },
    );
  }

  return Response.json({ error: "Неизвестное действие" }, { status: 400 });
}
