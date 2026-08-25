import { createHash, randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export type CommunityMessage = {
  id: string;
  createdAt: string;
  /** Хэш почты — без сырого email в ответах клиенту */
  authorKey: string;
  displayName: string;
  city?: string;
  text: string;
  mood?: string;
};

type Store = { messages: CommunityMessage[] };

const DATA_DIR = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "community-messages.json");
const MAX_MESSAGES = 400;
const MAX_TEXT = 500;

const SEED: Omit<CommunityMessage, "id" | "createdAt">[] = [
  {
    authorKey: "maya",
    displayName: "Мая",
    text: "Добро пожаловать в кружок мам 💛 Здесь можно выдохнуть, спросить и просто поболтать — без оценок.",
    mood: "💛",
  },
  {
    authorKey: "seed-lena",
    displayName: "Лена",
    city: "Казань",
    text: "Кто тоже ночью гуглит «нормально ли…» и потом смеётся над собой утром?",
    mood: "😴",
  },
  {
    authorKey: "seed-masha",
    displayName: "Маша",
    city: "Москва",
    text: "Мы сегодня впервые вышли на площадку — я горжусь нами обеими, хотя просто сидели на лавке 😄",
    mood: "☀️",
  },
];

function load(): Store {
  try {
    if (!existsSync(DATA_FILE)) {
      const seeded = seedStore();
      save(seeded);
      return seeded;
    }
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Store;
    if (!Array.isArray(raw.messages)) return seedStore();
    if (raw.messages.length === 0) {
      const seeded = seedStore();
      save(seeded);
      return seeded;
    }
    return raw;
  } catch {
    return seedStore();
  }
}

function seedStore(): Store {
  const now = Date.now();
  return {
    messages: SEED.map((m, i) => ({
      ...m,
      id: `seed-${i + 1}`,
      createdAt: new Date(now - (SEED.length - i) * 60_000).toISOString(),
    })),
  };
}

function save(store: Store) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

export function authorKeyFromEmail(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

export function listCommunityMessages(limit = 80): CommunityMessage[] {
  const all = load().messages;
  return all.slice(-Math.min(120, Math.max(20, limit)));
}

/** Только сообщения новее указанного id (для «живого» чата) */
export function listCommunityMessagesAfter(
  afterId: string | null | undefined,
  limit = 80,
): CommunityMessage[] {
  const all = load().messages;
  if (!afterId) return listCommunityMessages(limit);
  const idx = all.findIndex((m) => m.id === afterId);
  if (idx < 0) return listCommunityMessages(limit);
  return all.slice(idx + 1);
}

export function addCommunityMessage(input: {
  email: string;
  displayName: string;
  text: string;
  city?: string;
  mood?: string;
}): { ok: true; message: CommunityMessage } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Нужна почта аккаунта" };
  }

  const displayName = input.displayName.trim().slice(0, 32);
  if (displayName.length < 2) {
    return { ok: false, error: "Как вас зовут в кружке? Хотя бы 2 буквы" };
  }

  const text = input.text.trim().slice(0, MAX_TEXT);
  if (text.length < 1) {
    return { ok: false, error: "Напишите хоть пару слов" };
  }
  if (/https?:\/\/|www\./i.test(text)) {
    return { ok: false, error: "Ссылки пока лучше не кидать — только живое общение" };
  }

  const mood = input.mood?.trim().slice(0, 4) || undefined;
  const city = input.city?.trim().slice(0, 40) || undefined;
  const authorKey = authorKeyFromEmail(email);

  const store = load();
  // антиспам: не чаще раза в 4 сек от одного автора
  const last = [...store.messages].reverse().find((m) => m.authorKey === authorKey);
  if (last && Date.now() - new Date(last.createdAt).getTime() < 4000) {
    return { ok: false, error: "Секундочку… можно чуть помедленнее 💛" };
  }

  const message: CommunityMessage = {
    id: `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`,
    createdAt: new Date().toISOString(),
    authorKey,
    displayName,
    city,
    text,
    mood,
  };

  store.messages.push(message);
  if (store.messages.length > MAX_MESSAGES) {
    store.messages = store.messages.slice(-MAX_MESSAGES);
  }
  save(store);
  return { ok: true, message };
}
