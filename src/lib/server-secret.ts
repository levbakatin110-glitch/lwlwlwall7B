import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const SECRET_FILE = join(DATA_DIR, "auth-secret");

/** Значения, которые лежали в публичном репозитории: ими подписывать нельзя. */
const LEAKED = new Set([
  "DPEZn35NF4GXiXF/tJrPE4tgrGS55JeVCSpLVZ39sWM=",
  "maya-dev-oauth-secret-change-me",
]);

const g = globalThis as typeof globalThis & { __mayaAuthSecret?: string };

function usable(v: string | undefined): string | null {
  const s = v?.trim();
  if (!s || s.length < 8 || LEAKED.has(s)) return null;
  return s;
}

function fileSecret(): string {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  try {
    writeFileSync(SECRET_FILE, randomBytes(32).toString("base64"), {
      flag: "wx",
      mode: 0o600,
    });
    console.warn(
      "[maya] AUTH_SECRET не задан: создан data/auth-secret. Лучше задать AUTH_SECRET в .env.production.",
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  return readFileSync(SECRET_FILE, "utf8").trim();
}

/** Секрет для HMAC сессий и OAuth state. */
export function authSecret(): string {
  if (g.__mayaAuthSecret) return g.__mayaAuthSecret;
  const secret =
    usable(process.env.AUTH_SECRET) ||
    usable(process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY) ||
    usable(process.env.TELEGRAM_WEBHOOK_SECRET) ||
    usable(process.env.ANALYTICS_PASSWORD) ||
    fileSecret();
  g.__mayaAuthSecret = secret;
  return secret;
}
