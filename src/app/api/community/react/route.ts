import { reactToCommunityMessage } from "@/lib/community-store";
import { readSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json(
      { error: "Войдите, чтобы ставить реакции" },
      { status: 401 },
    );
  }
  try {
    const body = (await req.json()) as { id?: string; emoji?: string };
    const result = reactToCommunityMessage(
      session.email,
      String(body.id || ""),
      String(body.emoji || ""),
    );
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({ ok: true, message: result.message });
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
}
