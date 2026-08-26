import { upsertCommunityAvatar } from "@/lib/community-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { email?: string; avatar?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const result = upsertCommunityAvatar(
    String(body.email || ""),
    String(body.avatar || ""),
  );
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
