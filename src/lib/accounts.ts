import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { normalizeEmail } from "@/lib/email-codes";

type Account = {
  email: string;
  /** scrypt: saltHex:keyHex */
  passwordHash: string;
  updatedAt: string;
};

type Store = { accounts: Record<string, Account> };

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "accounts.json");

function empty(): Store {
  return { accounts: {} };
}

function load(): Store {
  try {
    if (!existsSync(FILE)) return empty();
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Store;
    if (!parsed?.accounts || typeof parsed.accounts !== "object") return empty();
    return parsed;
  } catch {
    return empty();
  }
}

function save(store: Store) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(store, null, 2), "utf8");
}

function hashPassword(password: string, salt = randomBytes(16)): string {
  const key = scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(keyHex, "hex");
    const actual = scryptSync(password, salt, expected.length);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function passwordLooksOk(password: string): boolean {
  return password.length >= 6 && password.length <= 72;
}

export function hasPassword(email: string): boolean {
  const key = normalizeEmail(email);
  return Boolean(load().accounts[key]?.passwordHash);
}

export function setAccountPassword(
  email: string,
  password: string,
): { ok: true } | { ok: false; error: string } {
  if (!passwordLooksOk(password)) {
    return { ok: false, error: "Пароль — от 6 символов" };
  }
  const key = normalizeEmail(email);
  const store = load();
  store.accounts[key] = {
    email: key,
    passwordHash: hashPassword(password),
    updatedAt: new Date().toISOString(),
  };
  save(store);
  return { ok: true };
}

export function verifyAccountPassword(
  email: string,
  password: string,
): boolean {
  const key = normalizeEmail(email);
  const row = load().accounts[key];
  if (!row?.passwordHash) return false;
  return verifyPassword(password, row.passwordHash);
}
