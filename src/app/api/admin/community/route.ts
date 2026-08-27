import { requireAdmin } from "@/lib/admin-auth";
import {
  deleteCommunityByKind,
  deleteCommunityMessage,
  type CommunityMediaKind,
} from "@/lib/community-store";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нужен пароль админки" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim() || "";
  const kind = url.searchParams.get("kind")?.trim() as CommunityMediaKind | "";
  if (id) {
    const ok = deleteCommunityMessage(id);
    if (!ok) return Response.json({ error: "Сообщение не найдено" }, { status: 404 });
    return Response.json({ ok: true, deleted: 1 });
  }
  if (kind === "voice" || kind === "circle" || kind === "image" || kind === "video") {
    const deleted = deleteCommunityByKind(kind);
    return Response.json({ ok: true, deleted });
  }
  return Response.json({ error: "Нужен id или kind=voice" }, { status: 400 });
}
