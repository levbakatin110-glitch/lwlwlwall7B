import {
  addCommunityMessage,
  deleteOwnCommunityMessage,
  listCommunityMessages,
  type CommunityMediaKind,
} from "@/lib/community-store";
import { resolveUploadMime } from "@/lib/media-mime";
import { readSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "80");
  const messages = listCommunityMessages(
    Number.isFinite(limit) ? limit : 80,
  );
  return Response.json({ messages });
}

export async function POST(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json(
      { error: "Войдите по почте, чтобы писать" },
      { status: 401 },
    );
  }
  const email = session.email;
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const displayName = String(form.get("displayName") || "");
      const text = String(form.get("text") || "");
      const babyTag = String(form.get("babyTag") || "");
      const avatar = String(form.get("avatar") || "");
      const mediaKind = String(form.get("mediaKind") || "") as CommunityMediaKind;
      const file = form.get("file");

      let media:
        | { kind: CommunityMediaKind; buffer: Buffer; mime: string }
        | undefined;

      if (file && typeof file === "object" && "arrayBuffer" in file) {
        const f = file as File;
        const buf = Buffer.from(await f.arrayBuffer());
        const kind: CommunityMediaKind =
          mediaKind === "circle" ||
          mediaKind === "video" ||
          mediaKind === "image" ||
          mediaKind === "voice"
            ? mediaKind
            : f.type.startsWith("video/")
              ? "video"
              : f.type.startsWith("audio/")
                ? "voice"
                : "image";
        const mime = resolveUploadMime(buf, f.type || "", kind);
        media = { kind, buffer: buf, mime };
      }

      const replyToId = String(form.get("replyToId") || "").trim();

      const result = await addCommunityMessage({
        email,
        displayName,
        text,
        babyTag: babyTag || undefined,
        replyToId: replyToId || undefined,
        avatarDataUrl: avatar.startsWith("data:image/") ? avatar : undefined,
        media,
      });

      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({ ok: true, message: result.message });
    }

    const body = (await req.json()) as {
      displayName?: string;
      text?: string;
      avatar?: string;
      babyTag?: string;
      replyToId?: string;
    };

    const result = await addCommunityMessage({
      email,
      displayName: String(body.displayName || ""),
      text: String(body.text || ""),
      babyTag: body.babyTag ? String(body.babyTag) : undefined,
      replyToId: body.replyToId ? String(body.replyToId) : undefined,
      avatarDataUrl: body.avatar?.startsWith("data:image/")
        ? String(body.avatar)
        : undefined,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({ ok: true, message: result.message });
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json(
      { error: "Войдите, чтобы удалять" },
      { status: 401 },
    );
  }
  try {
    const url = new URL(req.url);
    let id = url.searchParams.get("id")?.trim() || "";
    if (!id) {
      const body = (await req.json()) as { id?: string };
      id = String(body.id || "").trim();
    }
    const result = deleteOwnCommunityMessage(session.email, id);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
}
