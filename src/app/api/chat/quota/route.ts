import { getChatQuotaView } from "@/lib/chat-quota-store";
import { getServerSubscription } from "@/lib/paid-store";
import { readSessionFromRequest } from "@/lib/session";
import { TEMP_UNLOCK_ALL } from "@/lib/subscription";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = readSessionFromRequest(req);
  const qEmail = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  const email = session?.email || qEmail;
  if (!email) {
    return Response.json({ ok: false, error: "Нужен вход" }, { status: 401 });
  }

  const sub = getServerSubscription(email);
  const premium = TEMP_UNLOCK_ALL || Boolean(sub);
  const view = getChatQuotaView(email);

  return Response.json({
    ok: true,
    premium,
    ...view,
  });
}
