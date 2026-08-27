import { upsertCommunityAvatar } from "@/lib/community-store";
import { readSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите по почте" }, { status: 401 });
  }
  let body: { avatar?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const result = upsertCommunityAvatar(
    session.email,
    String(body.avatar || ""),
  );
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
