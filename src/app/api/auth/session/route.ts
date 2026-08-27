import {
  readSessionFromRequest,
  sessionClearCookie,
} from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ email: null });
  }
  return Response.json({ email: session.email, ok: true });
}

export async function DELETE() {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": sessionClearCookie() } },
  );
}
