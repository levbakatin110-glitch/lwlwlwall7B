import { getServerSubscription } from "@/lib/paid-store";
import { readSessionFromRequest } from "@/lib/session";
import { TEMP_UNLOCK_ALL } from "@/lib/subscription";

export function requirePaidSession(req: Request):
  | { ok: true; email: string }
  | { ok: false; response: Response } {
  const session = readSessionFromRequest(req);
  if (!session?.email) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "Войдите в аккаунт",
          code: "auth_required",
        },
        { status: 401 },
      ),
    };
  }
  if (TEMP_UNLOCK_ALL || getServerSubscription(session.email)) {
    return { ok: true, email: session.email };
  }
  return {
    ok: false,
    response: Response.json(
      {
        error: "Доступно с Premium. Оформите подписку.",
        code: "premium_required",
      },
      { status: 402 },
    ),
  };
}
