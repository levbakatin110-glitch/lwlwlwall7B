import { readSessionFromRequest } from "@/lib/session";
import {
  checkFeedbackRateLimit,
  clientIpFromRequest,
  feedbackRateLimitKey,
  markFeedbackSent,
  sendSiteFeedback,
} from "@/lib/site-feedback";

export const runtime = "nodejs";

function rateLimitMessage(retryAfterSec: number): string {
  const hours = Math.ceil(retryAfterSec / 3600);
  if (hours >= 2) {
    return `Можно отправить ещё одно сообщение через ${hours} ч. Так мы защищаемся от спама.`;
  }
  const mins = Math.ceil(retryAfterSec / 60);
  return `Можно отправить ещё одно сообщение через ${mins} мин. Так мы защищаемся от спама.`;
}

export async function POST(req: Request) {
  let body: { message?: string; page?: string };
  try {
    body = (await req.json()) as { message?: string; page?: string };
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const message = String(body.message || "").trim();
  if (message.length < 4) {
    return Response.json(
      { error: "Напишите хотя бы пару слов — что не нравится или что улучшить" },
      { status: 400 },
    );
  }
  if (message.length > 2000) {
    return Response.json({ error: "Слишком длинное сообщение" }, { status: 400 });
  }

  const session = readSessionFromRequest(req);
  const ip = clientIpFromRequest(req);
  const rateKey = feedbackRateLimitKey({ email: session?.email, ip });
  if (rateKey) {
    const limited = checkFeedbackRateLimit(rateKey);
    if (!limited.ok) {
      return Response.json(
        { error: rateLimitMessage(limited.retryAfterSec), retryAfterSec: limited.retryAfterSec },
        { status: 429 },
      );
    }
  }

  const sent = await sendSiteFeedback({
    message,
    fromEmail: session?.email,
    page: body.page,
    userAgent: req.headers.get("user-agent") || undefined,
  });

  if (!sent.ok) {
    return Response.json({ error: sent.error }, { status: 500 });
  }

  if (rateKey) markFeedbackSent(rateKey);

  return Response.json({ ok: true });
}
