/** Коды подтверждения почты (в памяти процесса — для одного VPS ок). */

type CodeEntry = {
  code: string;
  expiresAt: number;
  attempts: number;
};

const g = globalThis as typeof globalThis & {
  __mayaEmailCodes?: Map<string, CodeEntry>;
};

function store() {
  if (!g.__mayaEmailCodes) g.__mayaEmailCodes = new Map();
  return g.__mayaEmailCodes;
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
  store().set(key, {
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
  const entry = store().get(key);
  if (!entry) {
    return { ok: false, error: "Сначала запросите код на почту" };
  }
  if (Date.now() > entry.expiresAt) {
    store().delete(key);
    return { ok: false, error: "Код устарел — запросите новый" };
  }
  entry.attempts += 1;
  if (entry.attempts > 8) {
    store().delete(key);
    return { ok: false, error: "Слишком много попыток — запросите новый код" };
  }
  if (entry.code !== code.trim()) {
    return { ok: false, error: "Неверный код" };
  }
  store().delete(key);
  return { ok: true };
}
