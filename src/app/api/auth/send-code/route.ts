import { createEmailCode, isValidEmail, normalizeEmail } from "@/lib/email-codes";
import { sendRegistrationCodeEmail } from "@/lib/resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const email = normalizeEmail(body.email || "");
  if (!isValidEmail(email)) {
    return Response.json({ error: "Укажите корректную почту" }, { status: 400 });
  }

  const code = createEmailCode(email);
  const sent = await sendRegistrationCodeEmail({ to: email, code });
  if (!sent.ok) {
    return Response.json({ error: sent.error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
