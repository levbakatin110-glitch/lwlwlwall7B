import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { mergeBackupData } from "@/lib/backup-merge";
import { normalizeEmail } from "@/lib/email-codes";
import { readSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";

const DATA_DIR = join(process.cwd(), "data", "backups");
const MAX_BYTES = 1_800_000;

function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function fileFor(email: string) {
  const key = createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex")
    .slice(0, 24);
  return join(DATA_DIR, `${key}.json`);
}

/** Скачать бэкап профиля/дневников */
export async function GET(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите" }, { status: 401 });
  }
  try {
    ensure();
    const path = fileFor(session.email);
    if (!existsSync(path)) {
      return Response.json({ ok: true, backup: null });
    }
    const raw = readFileSync(path, "utf8");
    if (raw.length > MAX_BYTES + 1000) {
      return Response.json({ error: "Бэкап повреждён" }, { status: 500 });
    }
    const backup = JSON.parse(raw) as unknown;
    return Response.json({ ok: true, backup });
  } catch {
    return Response.json({ error: "Не удалось прочитать" }, { status: 500 });
  }
}

/** Сохранить бэкап (клиент шлёт JSON стора) */
export async function PUT(req: Request) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: "Войдите" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { backup?: unknown };
    if (!body.backup || typeof body.backup !== "object") {
      return Response.json({ error: "Нет данных" }, { status: 400 });
    }
    const incoming = body.backup as Record<string, unknown>;
    let data = incoming;
    const path = fileFor(session.email);
    if (existsSync(path)) {
      try {
        const prev = JSON.parse(readFileSync(path, "utf8")) as {
          data?: Record<string, unknown>;
        };
        if (prev.data && typeof prev.data === "object") {
          data = mergeBackupData(prev.data, incoming);
        }
      } catch {
        data = incoming;
      }
    }
    const json = JSON.stringify({
      v: 1,
      email: session.email,
      savedAt: new Date().toISOString(),
      data,
    });
    if (json.length > MAX_BYTES) {
      return Response.json(
        { error: "Слишком много данных (уберите тяжёлые фото)" },
        { status: 400 },
      );
    }
    ensure();
    writeFileSync(fileFor(session.email), json, "utf8");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
}
