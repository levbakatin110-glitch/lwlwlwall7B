import { syncYookassaForEmail } from "@/lib/yookassa-payments";
import { readSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";

/** После возврата с оплаты проверяем незакрытые платежи этой почты. */
export async function POST(req: Request) {
  const session = readSessionFromRequest(req);
  const email = session?.email?.trim().toLowerCase() || "";
  if (!email) {
    return Response.json({ error: "Войдите в аккаунт" }, { status: 401 });
  }
  const granted = await syncYookassaForEmail(email);
  return Response.json({ ok: true, granted });
}
