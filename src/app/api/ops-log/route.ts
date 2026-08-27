import {
  clearServerOpsErrors,
  listServerOpsErrors,
  pushServerOpsError,
  type OpsErrorLog,
} from "@/lib/ops-log";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** Серверный лог ошибок для админки */
export async function GET(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нужен пароль админки" }, { status: 401 });
  }
  return Response.json({ errors: listServerOpsErrors() });
}

export async function POST(req: Request) {
  // клиентские ошибки можно писать без пароля (короткий лог)
  try {
    const body = (await req.json()) as Partial<OpsErrorLog>;
    if (!body.message) {
      return Response.json({ error: "Нужен message" }, { status: 400 });
    }
    const row = pushServerOpsError({
      source: body.source || "other",
      message: String(body.message).slice(0, 500),
      userSnippet: body.userSnippet
        ? String(body.userSnippet).slice(0, 200)
        : undefined,
      status: body.status,
      detail: body.detail ? String(body.detail).slice(0, 800) : undefined,
    });
    return Response.json({ ok: true, error: row });
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нужен пароль админки" }, { status: 401 });
  }
  clearServerOpsErrors();
  return Response.json({ ok: true });
}
