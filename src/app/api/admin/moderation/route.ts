import { requireAdmin } from "@/lib/admin-auth";
import {
  clearModerationStrike,
  listModerationStrikes,
} from "@/lib/community-moderation";
import { getCommunityNickByAuthorKey } from "@/lib/community-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нужен пароль админки" }, { status: 401 });
  }
  const strikes = listModerationStrikes().map((row) => ({
    ...row,
    nick: getCommunityNickByAuthorKey(row.authorKey) ?? null,
  }));
  return Response.json({ strikes });
}

export async function DELETE(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нужен пароль админки" }, { status: 401 });
  }
  let authorKey = "";
  try {
    const url = new URL(req.url);
    authorKey = url.searchParams.get("authorKey") || "";
    if (!authorKey) {
      const body = (await req.json()) as { authorKey?: string };
      authorKey = body.authorKey || "";
    }
  } catch {
    authorKey = "";
  }
  if (!authorKey.trim()) {
    return Response.json({ error: "Нужен authorKey" }, { status: 400 });
  }
  const ok = clearModerationStrike(authorKey);
  if (!ok) {
    return Response.json({ error: "Запись не найдена" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
