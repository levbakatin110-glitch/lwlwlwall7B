import {
  isAllowedRussianEmail,
  isValidEmail,
  normalizeEmail,
  RUSSIAN_EMAIL_HINT,
  verifyEmailCode,
} from "@/lib/email-codes";
import { sessionSetCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { email?: string; code?: string };
  try {
    body = (await req.json()) as { email?: string; code?: string };
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
    return Response.json({ error: "Код — 6 цифр из письма" }, { status: 400 });
  }

  const result = verifyEmailCode(email, code);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(
    { ok: true, email },
    { headers: { "Set-Cookie": sessionSetCookie(email) } },
  );
}
