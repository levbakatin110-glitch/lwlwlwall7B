import { getChatQuotaView } from "@/lib/chat-quota-store";
import { getServerSubscription } from "@/lib/paid-store";
import { readSessionFromRequest } from "@/lib/session";
import { TEMP_UNLOCK_ALL } from "@/lib/subscription";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session?.email) {
    return Response.json({ ok: false, error: "Нужен вход" }, { status: 401 });
  }

  const sub = getServerSubscription(session.email);
  const premium = TEMP_UNLOCK_ALL || Boolean(sub);
  const view = getChatQuotaView(session.email);

  return Response.json({
    ok: true,
    premium,
    ...view,
  });
}
