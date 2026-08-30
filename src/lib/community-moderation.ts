import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

function authorKeyFromEmail(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

type Strike = {
  count: number;
  /** мут до этого времени */
  mutedUntil: number;
  /** кик = нельзя писать навсегда (пока не снимут вручную) */
  kicked: boolean;
  lastReason?: string;
  updatedAt: string;
};

type ModStore = {
  strikes: Record<string, Strike>;
  /** последние тексты автора для антиспама */
  recent: Record<string, { text: string; at: number }[]>;
};

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "community-moderation.json");

const MUTE_MS = [0, 60 * 60_000, 24 * 60 * 60_000]; // 1-й страйк → 1ч, 2-й → 24ч, 3-й → kick
const SPAM_WINDOW_MS = 10 * 60_000;
const SPAM_SAME_COUNT = 6;
const FLOOD_WINDOW_MS = 60_000;
/** Мягкое предупреждение — без страйка */
const FLOOD_WARN = 28;
/** Жёсткий стоп на минуту — без страйка */
const FLOOD_HARD = 40;

const MEDIA_PLACEHOLDERS = new Set([
  "🎥 кружок",
  "🎬 видео",
  "📷 фото",
  "🎤 голосовое",
  "[media]",
]);

/** Маркетплейсы и «нормальные» магазины — ссылки можно */
const ALLOWED_HOST_SUFFIXES = [
  "hey-maya.ru",
  "wildberries.ru",
  "wb.ru",
  "ozon.ru",
  "avito.ru",
  "youla.ru",
  "market.yandex.ru",
  "megamarket.ru",
  "sbermegamarket.ru",
  "lamoda.ru",
  "detmir.ru",
  "dns-shop.ru",
  "mvideo.ru",
  "citilink.ru",
  "goldapple.ru",
  "letu.ru",
  "rendez-vous.ru",
  "apteka.ru",
  "eapteka.ru",
  "uteka.ru",
  "aliexpress.ru",
  "alibaba.com",
  "vk.com",
  "vk.ru",
  "ok.ru",
  "dzen.ru",
  "youtube.com",
  "youtu.be",
  "rutube.ru",
];

const BLOCKED_HOST_HINTS = [
  "bit.ly",
  "tinyurl.com",
  "t.me",
  "telegram.me",
  "discord.gg",
  "discord.com",
  "crypt",
  "casino",
  "bet365",
  "1xbet",
  "porn",
  "xxx",
  "phishing",
];

function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function load(): ModStore {
  try {
    ensure();
    if (!existsSync(FILE)) return { strikes: {}, recent: {} };
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as ModStore;
    return {
      strikes: raw.strikes || {},
      recent: raw.recent || {},
    };
  } catch {
    return { strikes: {}, recent: {} };
  }
}

function save(store: ModStore) {
  ensure();
  writeFileSync(FILE, JSON.stringify(store, null, 2), "utf8");
}

function hostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  if (BLOCKED_HOST_HINTS.some((b) => h.includes(b))) return false;
  return ALLOWED_HOST_SUFFIXES.some(
    (s) => h === s || h.endsWith(`.${s}`),
  );
}

/** Достаём URL из текста */
function extractUrls(text: string): string[] {
  const out: string[] = [];
  const re =
    /(?:https?:\/\/|www\.)[^\s<>"']+|([a-z0-9-]+\.)+(?:ru|com|net|org|io|xyz|top|click|info|site)(?:\/[^\s<>"']*)?/gi;
  const matches = text.match(re) || [];
  for (const m of matches) {
    let u = m.trim();
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    out.push(u);
  }
  return out;
}

export function checkCommunityText(text: string): {
  ok: true;
} | { ok: false; reason: "bad_link" | "spam"; error: string } {
  const urls = extractUrls(text);
  for (const raw of urls) {
    try {
      const u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return {
          ok: false,
          reason: "bad_link",
          error: "Такую ссылку нельзя",
        };
      }
      // IP в ссылке — подозрительно
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)) {
        return {
          ok: false,
          reason: "bad_link",
          error: "Ссылки на IP нельзя — только обычные магазины",
        };
      }
      if (!hostAllowed(u.hostname)) {
        return {
          ok: false,
          reason: "bad_link",
          error:
            "Подозрительная ссылка. Можно WB, Ozon, Avito, Яндекс Маркет и т.п.",
        };
      }
    } catch {
      return {
        ok: false,
        reason: "bad_link",
        error: "Битая ссылка",
      };
    }
  }
  return { ok: true };
}

function applyStrike(
  store: ModStore,
  authorKey: string,
  reason: string,
): { ok: false; error: string } {
  const prev = store.strikes[authorKey] || {
    count: 0,
    mutedUntil: 0,
    kicked: false,
    updatedAt: new Date().toISOString(),
  };
  if (prev.kicked) {
    return { ok: false, error: "Вы кикнуты из общения" };
  }

  const count = prev.count + 1;
  let mutedUntil = 0;
  let kicked = false;
  let error: string;

  if (count >= 3) {
    kicked = true;
    error =
      "Повторное нарушение — кик из общения. Напишите в Поддержку, если ошиблись.";
  } else if (count === 2) {
    mutedUntil = Date.now() + MUTE_MS[2]!;
    error =
      "Снова нарушение. Молчанка на 24 часа. Ещё раз — кик.";
  } else {
    mutedUntil = Date.now() + MUTE_MS[1]!;
    error =
      reason === "spam"
        ? "Похоже на спам. Молчанка на 1 час."
        : "Подозрительная ссылка. Молчанка на 1 час. WB/Ozon можно.";
  }

  store.strikes[authorKey] = {
    count,
    mutedUntil,
    kicked,
    lastReason: reason,
    updatedAt: new Date().toISOString(),
  };
  save(store);
  return { ok: false, error };
}

function noteRecent(store: ModStore, authorKey: string, text: string) {
  const now = Date.now();
  const list = (store.recent[authorKey] || []).filter(
    (x) => now - x.at < SPAM_WINDOW_MS,
  );
  list.push({ text: text.slice(0, 200).toLowerCase(), at: now });
  store.recent[authorKey] = list.slice(-60);
}

function trackKey(text: string, hasMedia?: boolean): string {
  const trimmed = text.trim();
  if (isUserTextForSpam(trimmed)) {
    return trimmed.slice(0, 200).toLowerCase();
  }
  if (hasMedia) {
    return `[media:${Date.now()}:${Math.random().toString(36).slice(2, 7)}]`;
  }
  return trimmed.slice(0, 200).toLowerCase() || `[empty:${Date.now()}]`;
}

function isUserTextForSpam(text: string): boolean {
  const norm = text.trim();
  return norm.length > 0 && !MEDIA_PLACEHOLDERS.has(norm);
}

function floodCount(store: ModStore, authorKey: string): number {
  const now = Date.now();
  return (store.recent[authorKey] || []).filter(
    (x) => now - x.at < FLOOD_WINDOW_MS,
  ).length;
}

function checkFlood(
  store: ModStore,
  authorKey: string,
): { ok: true } | { ok: false; error: string } {
  const flood = floodCount(store, authorKey);
  if (flood >= FLOOD_HARD) {
    return {
      ok: false,
      error: "Очень много сообщений за минуту — подождите пару минут",
    };
  }
  if (flood >= FLOOD_WARN) {
    return {
      ok: false,
      error: "Вы пишете очень часто — чуть медленнее, без молчанки",
    };
  }
  return { ok: true };
}

function isDuplicateSpam(store: ModStore, authorKey: string, text: string): boolean {
  if (!isUserTextForSpam(text)) return false;
  const now = Date.now();
  const list = store.recent[authorKey] || [];
  const norm = text.slice(0, 200).toLowerCase().trim();
  const same = list.filter(
    (x) => x.text === norm && now - x.at < SPAM_WINDOW_MS,
  ).length;
  return same >= SPAM_SAME_COUNT - 1;
}

/**
 * Проверка перед постом. Мат можно. Спам / мусорные ссылки — страйк.
 */
export function moderateCommunityPost(input: {
  email: string;
  text: string;
  babyTag?: string;
  hasMedia?: boolean;
}): { ok: true } | { ok: false; error: string } {
  const authorKey = authorKeyFromEmail(input.email);
  const store = load();
  const strike = store.strikes[authorKey];

  if (strike?.kicked) {
    return { ok: false, error: "Вы кикнуты из общения" };
  }
  if (strike && strike.mutedUntil > Date.now()) {
    const mins = Math.ceil((strike.mutedUntil - Date.now()) / 60_000);
    return {
      ok: false,
      error: `Молчанка ещё ~${mins} мин. (нарушение ссылок/спама)`,
    };
  }

  const text = (input.text || "").trim();
  const babyTag = (input.babyTag || "").trim();
  const parts = [text, babyTag].filter(Boolean);

  for (const part of parts) {
    const linkCheck = checkCommunityText(part);
    if (!linkCheck.ok) {
      return applyStrike(store, authorKey, linkCheck.reason);
    }
  }

  const trackText = trackKey(text || babyTag || "", input.hasMedia);

  const flood = checkFlood(store, authorKey);
  if (!flood.ok) return flood;

  if (trackText) {
    if (isDuplicateSpam(store, authorKey, text || babyTag || "")) {
      return applyStrike(store, authorKey, "spam");
    }
    noteRecent(store, authorKey, trackText);
    save(store);
  }

  return { ok: true };
}

export function moderationFingerprint(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 12);
}

export type ModerationStrikeRow = {
  authorKey: string;
  count: number;
  mutedUntil: number;
  kicked: boolean;
  lastReason?: string;
  updatedAt: string;
  muted: boolean;
};

export function listModerationStrikes(): ModerationStrikeRow[] {
  const store = load();
  const now = Date.now();
  return Object.entries(store.strikes)
    .map(([authorKey, s]) => ({
      authorKey,
      count: s.count,
      mutedUntil: s.mutedUntil,
      kicked: s.kicked,
      lastReason: s.lastReason,
      updatedAt: s.updatedAt,
      muted: s.mutedUntil > now,
    }))
    .filter((r) => r.kicked || r.muted || r.count > 0)
    .sort((a, b) => {
      if (a.kicked !== b.kicked) return a.kicked ? -1 : 1;
      if (a.muted !== b.muted) return a.muted ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

/** Снимает мут и кик — можно снова писать. */
export function clearModerationStrike(authorKey: string): boolean {
  const key = authorKey.trim().slice(0, 32);
  if (!key) return false;
  const store = load();
  if (!store.strikes[key] && !store.recent[key]) return false;
  delete store.strikes[key];
  delete store.recent[key];
  save(store);
  return true;
}
