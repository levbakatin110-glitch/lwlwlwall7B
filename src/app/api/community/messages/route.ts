import {
  addCommunityMessage,
  listCommunityMessages,
  type CommunityMediaKind,
} from "@/lib/community-store";

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
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const email = String(form.get("email") || "");
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
          mediaKind === "circle" || mediaKind === "video" || mediaKind === "image"
            ? mediaKind
            : f.type.startsWith("video/")
              ? "video"
              : "image";
        const mime =
          f.type && f.type !== "application/octet-stream"
            ? f.type
            : kind === "image"
              ? "image/jpeg"
              : kind === "circle" || kind === "video"
                ? "video/webm"
                : "application/octet-stream";
        media = { kind, buffer: buf, mime };
      }

      const result = await addCommunityMessage({
        email,
        displayName,
        text,
        babyTag: babyTag || undefined,
        avatarDataUrl: avatar.startsWith("data:image/") ? avatar : undefined,
        media,
      });

      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({ ok: true, message: result.message });
    }

    const body = (await req.json()) as {
      email?: string;
      displayName?: string;
      text?: string;
      avatar?: string;
      babyTag?: string;
    };

    const result = await addCommunityMessage({
      email: String(body.email || ""),
      displayName: String(body.displayName || ""),
      text: String(body.text || ""),
      babyTag: body.babyTag ? String(body.babyTag) : undefined,
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
