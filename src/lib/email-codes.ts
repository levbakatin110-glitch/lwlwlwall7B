/** Коды подтверждения почты — файл + память (переживают pm2 restart). */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

type CodeEntry = {
  code: string;
  expiresAt: number;
  attempts: number;
};

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "email-codes.json");

const g = globalThis as typeof globalThis & {
  __mayaEmailCodes?: Map<string, CodeEntry>;
};

function mem() {
  if (!g.__mayaEmailCodes) g.__mayaEmailCodes = new Map();
  return g.__mayaEmailCodes;
}

function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadFile(): Record<string, CodeEntry> {
  try {
    ensure();
    if (!existsSync(FILE)) return {};
    return JSON.parse(readFileSync(FILE, "utf8")) as Record<string, CodeEntry>;
  } catch {
    return {};
  }
}

function saveFile(store: Record<string, CodeEntry>) {
  ensure();
  const now = Date.now();
  const next: Record<string, CodeEntry> = {};
  for (const [k, v] of Object.entries(store)) {
    if (v.expiresAt > now) next[k] = v;
  }
  writeFileSync(FILE, JSON.stringify(next), "utf8");
}

function getEntry(key: string): CodeEntry | undefined {
  const m = mem().get(key);
  if (m) return m;
  const f = loadFile()[key];
  if (f) {
    mem().set(key, f);
    return f;
  }
  return undefined;
}

function setEntry(key: string, entry: CodeEntry) {
  mem().set(key, entry);
  const file = loadFile();
  file[key] = entry;
  saveFile(file);
}

function delEntry(key: string) {
  mem().delete(key);
  const file = loadFile();
  delete file[key];
  saveFile(file);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/** Российские / СНГ почтовые сервисы + любые адреса на .ru / .su / .рф */
const RU_MAILBOX_DOMAINS = new Set([
  "mail.ru",
  "bk.ru",
  "list.ru",
  "inbox.ru",
  "internet.ru",
  "xmail.ru",
  "yandex.ru",
  "ya.ru",
  "yandex.com",
  "yandex.by",
  "yandex.kz",
  "yandex.ua",
  "rambler.ru",
  "lenta.ru",
  "autorambler.ru",
  "myrambler.ru",
  "ro.ru",
  "vk.com",
  "ok.ru",
]);

export function isAllowedRussianEmail(email: string): boolean {
  if (!isValidEmail(email)) return false;
  const domain = normalizeEmail(email).split("@")[1] || "";
  if (RU_MAILBOX_DOMAINS.has(domain)) return true;
  if (
    domain.endsWith(".mail.ru") ||
    domain.endsWith(".yandex.ru") ||
    domain.endsWith(".yandex.com") ||
    domain.endsWith(".rambler.ru")
  ) {
    return true;
  }
  if (domain.endsWith(".ru") || domain.endsWith(".su") || domain.endsWith(".xn--p1ai")) {
    return true;
  }
  return false;
}

export const RUSSIAN_EMAIL_HINT =
  "Только российская почта: Mail.ru, Яндекс, Rambler или адрес на .ru";

export function createEmailCode(email: string): string {
  const key = normalizeEmail(email);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  setEntry(key, {
    code,
    expiresAt: Date.now() + 10 * 60_000,
    attempts: 0,
  });
  return code;
}

export function verifyEmailCode(
  email: string,
  code: string,
): { ok: true } | { ok: false; error: string } {
  const key = normalizeEmail(email);
  const entry = getEntry(key);
  if (!entry) {
    return { ok: false, error: "Сначала запросите код на почту" };
  }
  if (Date.now() > entry.expiresAt) {
    delEntry(key);
    return { ok: false, error: "Код устарел — запросите новый" };
  }
  entry.attempts += 1;
  if (entry.attempts > 8) {
    delEntry(key);
    return { ok: false, error: "Слишком много попыток — запросите новый код" };
  }
  if (entry.code !== code.trim()) {
    setEntry(key, entry);
    return { ok: false, error: "Неверный код" };
  }
  delEntry(key);
  return { ok: true };
}
