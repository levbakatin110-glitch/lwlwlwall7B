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
import { hitRateLimits, requestIp, tooManyRequests } from "@/lib/rate-limit";
import { sessionSetCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    email?: string;
    code?: string;
    consents?: { pd?: boolean; marketing?: boolean };
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const email = normalizeEmail(body.email || "");
  const code = String(body.code || "").trim();
  if (!isValidEmail(email)) {
    return Response.json({ error: "Укажите корректную почту" }, { status: 400 });
  }
  if (!isAllowedRussianEmail(email)) {
    return Response.json({ error: RUSSIAN_EMAIL_HINT }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return Response.json({ error: "Код, 6 цифр из письма" }, { status: 400 });
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

  const result = verifyEmailCode(email, code);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  if (givesPd) {
    try {
      recordRegistrationConsents({
        email,
        marketing: body.consents?.marketing === true,
        ip: requestIp(req),
        userAgent: req.headers.get("user-agent") || "",
      });
    } catch (e) {
      console.error("[consents]", e);
    }
  }

  return Response.json(
    { ok: true, email },
    { headers: { "Set-Cookie": sessionSetCookie(email) } },
  );
}
