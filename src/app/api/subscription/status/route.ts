import { getServerSubscription } from "@/lib/paid-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return Response.json({ active: false });
  }
  const sub = getServerSubscription(email);
  if (!sub) {
    return Response.json({ active: false, planId: "free", expiresAt: null });
  }
  return Response.json({
    active: true,
    planId: sub.planId,
    expiresAt: sub.expiresAt,
  });
}
