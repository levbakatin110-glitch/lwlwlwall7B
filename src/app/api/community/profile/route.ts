import {
  getCommunityProfile,
  upsertCommunityProfile,
} from "@/lib/community-store";
import { readSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите по почте" }, { status: 401 });
  }
  const profile = getCommunityProfile(session.email);
  return Response.json({ ok: true, profile });
}

export async function POST(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите по почте" }, { status: 401 });
  }
  let body: {
    nick?: string;
    babyName?: string;
    babyBirth?: string;
    avatar?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const result = upsertCommunityProfile({
    email: session.email,
    nick: String(body.nick || ""),
    babyName: body.babyName,
    babyBirth: body.babyBirth,
    avatarDataUrl: body.avatar,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({
    ok: true,
    profile: getCommunityProfile(session.email),
  });
}
