import { requireAdmin } from "@/lib/admin-auth";
import { listMarketingContacts, revokeMarketing } from "@/lib/consent-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нужен пароль админки" }, { status: 401 });
  }
  return Response.json({ contacts: listMarketingContacts() });
}

/** Отметить отзыв согласия на рассылку: { email } */
export async function DELETE(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нужен пароль админки" }, { status: 401 });
  }
  let email = "";
  try {
    email = String(((await req.json()) as { email?: string }).email || "");
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (!email.includes("@")) {
    return Response.json({ error: "Нужна почта" }, { status: 400 });
  }
  return Response.json({ ok: revokeMarketing(email) });
}
