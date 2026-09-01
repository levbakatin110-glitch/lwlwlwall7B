import { readSessionFromRequest } from "@/lib/session";
import { sendSiteFeedback } from "@/lib/site-feedback";

export const runtime = "nodejs";

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
  const sent = await sendSiteFeedback({
    message,
    fromEmail: session?.email,
    page: body.page,
    userAgent: req.headers.get("user-agent") || undefined,
  });

  if (!sent.ok) {
    return Response.json({ error: sent.error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
