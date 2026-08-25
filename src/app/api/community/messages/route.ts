import {
  addCommunityMessage,
  listCommunityMessages,
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
  let body: {
    email?: string;
    displayName?: string;
    text?: string;
    city?: string;
    mood?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const result = addCommunityMessage({
    email: String(body.email || ""),
    displayName: String(body.displayName || ""),
    text: String(body.text || ""),
    city: body.city ? String(body.city) : undefined,
    mood: body.mood ? String(body.mood) : undefined,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ ok: true, message: result.message });
}
