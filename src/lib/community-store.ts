import { createHash, randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export type CommunityMessage = {
  id: string;
  createdAt: string;
  /** Хэш почты — без сырого email в ответах клиенту */
  authorKey: string;
  displayName: string;
  /** data URL или пусто */
  avatar?: string;
  /** мини-тег: «Ваня · 12.03.2024» */
  babyTag?: string;
  text: string;
};

type Store = { messages: CommunityMessage[] };

const DATA_DIR = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "community-messages.json");
const MAX_MESSAGES = 400;
const MAX_TEXT = 500;
/** ~80 KB — иначе файл сообщений раздувается */
const MAX_AVATAR_CHARS = 80_000;

const SEED: Omit<CommunityMessage, "id" | "createdAt">[] = [
  {
    authorKey: "maya",
    displayName: "Мая",
    text: "Добро пожаловать. Пишите спокойно — беременность, малыш, быт. Без оценок.",
  },
  {
    authorKey: "seed-lena",
    displayName: "Лена",
    babyTag: "Миша · 03.01.2025",
    text: "Кто тоже ночью гуглит «нормально ли…» и утром смеётся?",
  },
  {
    authorKey: "seed-masha",
    displayName: "Маша",
    babyTag: "28 нед.",
    text: "Если вы тоже в ожидании — вы не одна.",
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

export function addCommunityMessage(input: {
  email: string;
  displayName: string;
  text: string;
  avatar?: string;
  babyTag?: string;
}): { ok: true; message: CommunityMessage } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Нужна почта аккаунта" };
  }

  const displayName = input.displayName.trim().slice(0, 32);
  if (displayName.length < 2) {
    return { ok: false, error: "Сначала укажите имя (хотя бы 2 буквы)" };
  }

  const text = input.text.trim().slice(0, MAX_TEXT);
  if (text.length < 1) {
    return { ok: false, error: "Пустое сообщение" };
  }
  if (/https?:\/\/|www\./i.test(text)) {
    return { ok: false, error: "Ссылки пока нельзя" };
  }

  let avatar = input.avatar?.trim() || undefined;
  if (avatar) {
    if (!avatar.startsWith("data:image/")) {
      return { ok: false, error: "Неверный формат фото" };
    }
    if (avatar.length > MAX_AVATAR_CHARS) {
      avatar = undefined;
    }
  }

  const babyTag = input.babyTag?.trim().slice(0, 48) || undefined;
  const authorKey = authorKeyFromEmail(email);

  const store = load();
  const last = [...store.messages].reverse().find((m) => m.authorKey === authorKey);
  if (last && Date.now() - new Date(last.createdAt).getTime() < 3000) {
    return { ok: false, error: "Подождите пару секунд" };
  }

  const message: CommunityMessage = {
    id: `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`,
    createdAt: new Date().toISOString(),
    authorKey,
    displayName,
    avatar,
    babyTag,
    text,
  };

  store.messages.push(message);
  if (store.messages.length > MAX_MESSAGES) {
    store.messages = store.messages.slice(-MAX_MESSAGES);
  }
  save(store);
  return { ok: true, message };
}
