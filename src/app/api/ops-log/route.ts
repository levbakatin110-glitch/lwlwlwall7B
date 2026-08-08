import {
  clearServerOpsErrors,
  listServerOpsErrors,
  pushServerOpsError,
  type OpsErrorLog,
} from "@/lib/ops-log";

export const runtime = "nodejs";

/** Серверный лог ошибок для админки */
export async function GET() {
  return Response.json({ errors: listServerOpsErrors() });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<OpsErrorLog>;
    if (!body.message) {
      return Response.json({ error: "Нужен message" }, { status: 400 });
    }
    const row = pushServerOpsError({
      source: body.source || "other",
      message: body.message,
      userSnippet: body.userSnippet,
      status: body.status,
      detail: body.detail,
    });
    return Response.json({ ok: true, error: row });
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
}

export async function DELETE() {
  clearServerOpsErrors();
  return Response.json({ ok: true });
}
