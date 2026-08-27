import { adminPasswordOk, adminSetCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (!adminPasswordOk(body.password)) {
    return Response.json({ error: "Неверный пароль" }, { status: 401 });
  }
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": adminSetCookie() } },
  );
}
