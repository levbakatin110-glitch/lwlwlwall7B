import { getServerSubscription } from "@/lib/paid-store";
import { readSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session?.email) {
    return Response.json({ active: false }, { status: 401 });
  }
  const sub = getServerSubscription(session.email);
  if (!sub) {
    return Response.json({ active: false, planId: "free", expiresAt: null });
  }
  return Response.json({
    active: true,
    planId: sub.planId,
    expiresAt: sub.expiresAt,
  });
}
