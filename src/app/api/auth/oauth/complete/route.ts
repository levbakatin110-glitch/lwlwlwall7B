import { consumeOAuthTicket } from "@/lib/oauth";
import { sessionSetCookie } from "@/lib/session";

export const runtime = "nodejs";

/** Обмен одноразового oauth-тикета на email (после редиректа с провайдера). */
export async function POST(req: Request) {
  let body: { ticket?: string };
  try {
    body = (await req.json()) as { ticket?: string };
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const ticket = String(body.ticket || "").trim();
  if (!ticket || ticket.length > 128) {
    return Response.json({ error: "Нет тикета входа" }, { status: 400 });
  }

  const result = consumeOAuthTicket(ticket);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(
    { ok: true, email: result.email },
    { headers: { "Set-Cookie": sessionSetCookie(result.email) } },
  );
}
