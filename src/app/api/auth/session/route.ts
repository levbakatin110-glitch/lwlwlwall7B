import {
  readSessionFromRequest,
  revokeAllSessions,
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

/**
 * Выход на этом устройстве.
 * `?all=1` ещё и завершает сессии на всех остальных устройствах этой почты.
 */
export async function DELETE(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  if (all) {
    const session = readSessionFromRequest(req);
    if (session) {
      try {
        revokeAllSessions(session.email);
      } catch (e) {
        console.error("[session] revokeAll failed", e);
        return Response.json(
          { ok: false, error: "Не удалось выйти на всех устройствах" },
          { status: 500 },
        );
      }
    }
  }
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": sessionClearCookie() } },
  );
}
