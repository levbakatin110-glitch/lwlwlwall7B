import { createHash, randomBytes } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { moderateCommunityPost } from "@/lib/community-moderation";
import { resolveUploadMime } from "@/lib/media-mime";
import { ensureSafariFriendlyBuffer } from "@/lib/transcode-media";
import {
  isCommunityReaction,
  mediaPreviewText,
} from "@/lib/community-reactions";

export type CommunityMediaKind = "image" | "video" | "circle" | "voice";

export type CommunityMessage = {
  id: string;
  createdAt: string;
  /** Хэш почты — без сырого email в ответах клиенту */
  authorKey: string;
  displayName: string;
  /** мини-тег: «Ваня · 12.03.2024» */
  babyTag?: string;
  text: string;
  /** имя файла в data/community-media */
  mediaFile?: string;
  mediaKind?: CommunityMediaKind;
  /** id сообщения, на которое отвечают */
  replyToId?: string;
  /** emoji → authorKeys */
  reactions?: Record<string, string[]>;
};

export type CommunityReplyDto = {
  id: string;
  displayName: string;
  text: string;
  mediaKind?: CommunityMediaKind;
};

/** Ответ клиенту — без base64, только URL */
export type CommunityMessageDto = Omit<CommunityMessage, "mediaFile"> & {
  avatarUrl?: string;
  mediaUrl?: string;
  replyTo?: CommunityReplyDto;
};

type Store = { messages: CommunityMessage[] };
export type CommunityProfileRecord = {
  avatarFile?: string;
  nick?: string;
  babyName?: string;
  babyBirth?: string;
  updatedAt: string;
};
type Profiles = Record<string, CommunityProfileRecord>;

const DATA_DIR = join(process.cwd(), "data");
const MEDIA_DIR = join(DATA_DIR, "community-media");
const AVATAR_DIR = join(DATA_DIR, "community-avatars");
const DATA_FILE = join(DATA_DIR, "community-messages.json");
const PROFILES_FILE = join(DATA_DIR, "community-profiles.json");

const MAX_MESSAGES = 200;
const MAX_TEXT = 500;
const MAX_AVATAR_BYTES = 180_000;
const MAX_IMAGE_BYTES = 900_000;
const MAX_VIDEO_BYTES = 12_000_000;
const MAX_CIRCLE_BYTES = 3_000_000;
const MAX_VOICE_BYTES = 2_000_000;

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

function ensureDirs() {
  for (const dir of [DATA_DIR, MEDIA_DIR, AVATAR_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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

function load(): Store {
  try {
    ensureDirs();
    if (!existsSync(DATA_FILE)) {
      const seeded = seedStore();
      save(seeded);
      return seeded;
    }
    const raw = readFileSync(DATA_FILE, "utf8");
    // Старый гигантский JSON с data-URL аватарами — вычищаем
    if (raw.length > 1_500_000) {
      const parsed = JSON.parse(raw) as Store;
      const cleaned: Store = {
        messages: (parsed.messages || []).slice(-MAX_MESSAGES).map((m) => {
          const { avatar: _a, ...rest } = m as CommunityMessage & {
            avatar?: string;
          };
          return rest;
        }),
      };
      save(cleaned);
      return cleaned;
    }
    const data = JSON.parse(raw) as Store;
    if (!Array.isArray(data.messages)) return seedStore();
    if (data.messages.length === 0) {
      const seeded = seedStore();
      save(seeded);
      return seeded;
    }
    // Убираем legacy avatar fields из памяти при чтении
    data.messages = data.messages.map((m) => {
      const row = { ...m } as CommunityMessage & { avatar?: string };
      delete row.avatar;
      return row;
    });
    return data;
  } catch {
    return seedStore();
  }
}

function save(store: Store) {
  try {
    ensureDirs();
    writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

function loadProfiles(): Profiles {
  try {
    ensureDirs();
    if (!existsSync(PROFILES_FILE)) return {};
    const data = JSON.parse(readFileSync(PROFILES_FILE, "utf8")) as Profiles;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function saveProfiles(profiles: Profiles) {
  try {
    ensureDirs();
    writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), "utf8");
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

function extFromMime(mime: string, kind: CommunityMediaKind): string {
  if (kind === "voice") {
    if (mime.includes("ogg")) return "ogg";
    if (mime.includes("mp4") || mime.includes("aac") || mime.includes("m4a")) {
      return "m4a";
    }
    return "webm";
  }
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime")) return "mov";
  if (kind === "image") return "jpg";
  return "webm";
}

function mimeFromExt(ext: string, kind?: CommunityMediaKind): string {
  const e = ext.toLowerCase();
  if (kind === "voice") {
    if (e === "ogg") return "audio/ogg";
    if (e === "m4a" || e === "mp4") return "audio/mp4";
    return "audio/webm";
  }
  if (e === "png") return "image/png";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "mp4") return "video/mp4";
  if (e === "mov") return "video/quicktime";
  if (e === "ogg") return "audio/ogg";
  if (e === "m4a") return "audio/mp4";
  if (e === "webm") return "video/webm";
  return "application/octet-stream";
}

function dataUrlToBuffer(dataUrl: string): { buf: Buffer; ext: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!m) return null;
  const mime = m[1];
  try {
    const buf = Buffer.from(m[2], "base64");
    return { buf, ext: extFromMime(mime, "image") };
  } catch {
    return null;
  }
}

function saveAuthorAvatar(
  authorKey: string,
  avatarDataUrl: string,
): string | undefined {
  const parsed = dataUrlToBuffer(avatarDataUrl);
  if (!parsed) return undefined;
  if (parsed.buf.length > MAX_AVATAR_BYTES) return undefined;
  ensureDirs();
  const file = `${authorKey}.${parsed.ext}`;
  const path = join(AVATAR_DIR, file);
  // удалить старые расширения
  for (const old of ["jpg", "jpeg", "png", "webp"]) {
    const p = join(AVATAR_DIR, `${authorKey}.${old}`);
    if (p !== path && existsSync(p)) {
      try {
        unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
  writeFileSync(path, parsed.buf);
  const profiles = loadProfiles();
  profiles[authorKey] = {
    ...profiles[authorKey],
    avatarFile: file,
    updatedAt: new Date().toISOString(),
  };
  saveProfiles(profiles);
  return file;
}

export function resolveAvatarPath(authorKey: string): string | null {
  const profiles = loadProfiles();
  const file = profiles[authorKey]?.avatarFile;
  if (file) {
    const p = join(AVATAR_DIR, file);
    if (existsSync(p)) return p;
  }
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const p = join(AVATAR_DIR, `${authorKey}.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

export function resolveMediaPath(messageId: string): {
  path: string;
  mime: string;
  kind?: CommunityMediaKind;
} | null {
  const store = load();
  const msg = store.messages.find((m) => m.id === messageId);
  if (!msg?.mediaFile) return null;
  const path = join(MEDIA_DIR, msg.mediaFile);
  if (!existsSync(path)) return null;
  const ext = msg.mediaFile.split(".").pop() || "";
  return {
    path,
    mime: mimeFromExt(ext, msg.mediaKind),
    kind: msg.mediaKind,
  };
}

function resolveReply(
  replyToId: string | undefined,
  all: CommunityMessage[],
): CommunityReplyDto | undefined {
  if (!replyToId) return undefined;
  const orig = all.find((x) => x.id === replyToId);
  if (!orig) {
    return { id: replyToId, displayName: "", text: "Сообщение удалено" };
  }
  const text =
    mediaPreviewText(orig.mediaKind, orig.text).slice(0, 120) || orig.text;
  return {
    id: orig.id,
    displayName: orig.displayName,
    text,
    mediaKind: orig.mediaKind,
  };
}

function toDto(
  m: CommunityMessage,
  profiles: Profiles,
  all: CommunityMessage[],
): CommunityMessageDto {
  const hasAvatar =
    Boolean(profiles[m.authorKey]?.avatarFile) ||
    Boolean(resolveAvatarPath(m.authorKey));
  const reactions = m.reactions
    ? Object.fromEntries(
        Object.entries(m.reactions).filter(([, keys]) => keys.length > 0),
      )
    : undefined;
  return {
    id: m.id,
    createdAt: m.createdAt,
    authorKey: m.authorKey,
    displayName: m.displayName,
    babyTag: m.babyTag,
    text: m.text,
    mediaKind: m.mediaKind,
    replyToId: m.replyToId,
    replyTo: resolveReply(m.replyToId, all),
    reactions:
      reactions && Object.keys(reactions).length > 0 ? reactions : undefined,
    avatarUrl: hasAvatar ? `/api/community/avatar/${m.authorKey}` : undefined,
    mediaUrl: m.mediaFile ? `/api/community/media/${m.id}` : undefined,
  };
}

export function listCommunityMessages(limit = 80): CommunityMessageDto[] {
  const all = load().messages;
  const profiles = loadProfiles();
  return all
    .slice(-Math.min(120, Math.max(20, limit)))
    .map((m) => toDto(m, profiles, all));
}

export async function addCommunityMessage(input: {
  email: string;
  displayName: string;
  text?: string;
  babyTag?: string;
  replyToId?: string;
  /** data URL — сохраняем файлом профиля */
  avatarDataUrl?: string;
  media?: {
    kind: CommunityMediaKind;
    buffer: Buffer;
    mime: string;
  };
}): Promise<
  { ok: true; message: CommunityMessageDto } | { ok: false; error: string }
> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Нужна почта аккаунта" };
  }

  const displayName = input.displayName.trim().slice(0, 32);
  if (displayName.length < 2) {
    return { ok: false, error: "Сначала укажите имя (хотя бы 2 буквы)" };
  }

  const text = (input.text || "").trim().slice(0, MAX_TEXT);
  const hasMedia = Boolean(input.media?.buffer?.length);
  if (!hasMedia && text.length < 1) {
    return { ok: false, error: "Пустое сообщение" };
  }

  const mod = moderateCommunityPost({
    email,
    text,
    babyTag: input.babyTag,
    hasMedia,
  });
  if (!mod.ok) {
    return { ok: false, error: mod.error };
  }

  if (input.media) {
    const { kind, buffer, mime } = input.media;
    const max =
      kind === "image"
        ? MAX_IMAGE_BYTES
        : kind === "circle"
          ? MAX_CIRCLE_BYTES
          : kind === "voice"
            ? MAX_VOICE_BYTES
            : MAX_VIDEO_BYTES;
    if (buffer.length > max) {
      return { ok: false, error: "Файл слишком большой" };
    }
    if (kind === "image" && !mime.startsWith("image/")) {
      return { ok: false, error: "Нужно изображение" };
    }
    if (kind === "voice") {
      const okVoice =
        !mime ||
        mime.startsWith("audio/") ||
        mime === "video/webm" ||
        mime === "application/octet-stream";
      if (!okVoice) {
        return { ok: false, error: "Нужно голосовое" };
      }
    }
    if (
      (kind === "video" || kind === "circle") &&
      mime &&
      !mime.startsWith("video/") &&
      mime !== "application/octet-stream"
    ) {
      return { ok: false, error: "Нужно видео" };
    }
  }

  const authorKey = authorKeyFromEmail(email);
  if (input.avatarDataUrl?.startsWith("data:image/")) {
    saveAuthorAvatar(authorKey, input.avatarDataUrl);
  }

  const babyTag = input.babyTag?.trim().slice(0, 48) || undefined;

  const store = load();
  const replyToId = input.replyToId?.trim() || undefined;
  if (replyToId && !store.messages.some((m) => m.id === replyToId)) {
    return { ok: false, error: "Сообщение для ответа не найдено" };
  }
  const last = [...store.messages]
    .reverse()
    .find((m) => m.authorKey === authorKey);
  if (last && Date.now() - new Date(last.createdAt).getTime() < 800) {
    return { ok: false, error: "Секунду — не так быстро" };
  }

  const id = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  let mediaFile: string | undefined;
  let mediaKind: CommunityMediaKind | undefined;

  if (input.media) {
    ensureDirs();
    const declared = resolveUploadMime(
      input.media.buffer,
      input.media.mime || "",
      input.media.kind,
    );
    const { buffer, mime } = await ensureSafariFriendlyBuffer(
      input.media.buffer,
      input.media.kind,
      declared,
    );
    const ext = extFromMime(mime, input.media.kind);
    mediaFile = `${id}.${ext}`;
    mediaKind = input.media.kind;
    writeFileSync(join(MEDIA_DIR, mediaFile), buffer);
  }

  const message: CommunityMessage = {
    id,
    createdAt: new Date().toISOString(),
    authorKey,
    displayName,
    babyTag,
    text: text || (mediaKind === "circle" ? "🎥 кружок" : mediaKind === "video" ? "🎬 видео" : mediaKind === "image" ? "📷 фото" : mediaKind === "voice" ? "🎤 голосовое" : ""),
    mediaFile,
    mediaKind,
    replyToId,
  };

  store.messages.push(message);
  if (store.messages.length > MAX_MESSAGES) {
    const dropped = store.messages.slice(0, store.messages.length - MAX_MESSAGES);
    store.messages = store.messages.slice(-MAX_MESSAGES);
    for (const d of dropped) {
      if (!d.mediaFile) continue;
      try {
        unlinkSync(join(MEDIA_DIR, d.mediaFile));
      } catch {
        /* ignore */
      }
    }
  }
  save(store);
  return { ok: true, message: toDto(message, loadProfiles(), store.messages) };
}

function unlinkMedia(mediaFile?: string) {
  if (!mediaFile) return;
  try {
    unlinkSync(join(MEDIA_DIR, mediaFile));
  } catch {
    /* ignore */
  }
}

export function deleteCommunityMessage(id: string): boolean {
  const key = id.trim();
  if (!key) return false;
  const store = load();
  const idx = store.messages.findIndex((m) => m.id === key);
  if (idx < 0) return false;
  unlinkMedia(store.messages[idx]?.mediaFile);
  store.messages.splice(idx, 1);
  save(store);
  return true;
}

export function deleteOwnCommunityMessage(
  email: string,
  id: string,
): { ok: true } | { ok: false; error: string } {
  const authorKey = authorKeyFromEmail(email);
  const key = id.trim();
  if (!key) return { ok: false, error: "Нет сообщения" };
  const store = load();
  const idx = store.messages.findIndex((m) => m.id === key);
  if (idx < 0) return { ok: false, error: "Сообщение не найдено" };
  const msg = store.messages[idx];
  if (msg.authorKey !== authorKey) {
    return { ok: false, error: "Можно удалить только своё" };
  }
  unlinkMedia(msg.mediaFile);
  store.messages.splice(idx, 1);
  save(store);
  return { ok: true };
}

export function reactToCommunityMessage(
  email: string,
  id: string,
  emoji: string,
):
  | { ok: true; message: CommunityMessageDto }
  | { ok: false; error: string } {
  if (!isCommunityReaction(emoji)) {
    return { ok: false, error: "Такой реакции нет" };
  }
  const authorKey = authorKeyFromEmail(email);
  const key = id.trim();
  const store = load();
  const msg = store.messages.find((m) => m.id === key);
  if (!msg) return { ok: false, error: "Сообщение не найдено" };

  const reactions: Record<string, string[]> = { ...(msg.reactions || {}) };
  const already = (reactions[emoji] || []).includes(authorKey);
  for (const [face, keys] of Object.entries(reactions)) {
    reactions[face] = keys.filter((k) => k !== authorKey);
    if (reactions[face].length === 0) delete reactions[face];
  }
  if (!already) {
    reactions[emoji] = [...(reactions[emoji] || []), authorKey];
  }
  msg.reactions = Object.keys(reactions).length ? reactions : undefined;
  save(store);
  return { ok: true, message: toDto(msg, loadProfiles(), store.messages) };
}

export function deleteCommunityByKind(kind: CommunityMediaKind): number {
  const store = load();
  let n = 0;
  store.messages = store.messages.filter((m) => {
    if (m.mediaKind !== kind) return true;
    unlinkMedia(m.mediaFile);
    n += 1;
    return false;
  });
  if (n) save(store);
  return n;
}

export function upsertCommunityAvatar(
  email: string,
  avatarDataUrl: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: "Нужна почта" };
  }
  if (!avatarDataUrl.startsWith("data:image/")) {
    return { ok: false, error: "Неверный формат фото" };
  }
  const key = authorKeyFromEmail(trimmed);
  const saved = saveAuthorAvatar(key, avatarDataUrl);
  if (!saved) return { ok: false, error: "Фото слишком большое" };
  return { ok: true };
}

export function getCommunityProfile(email: string): {
  nick: string;
  babyName: string;
  babyBirth: string;
  avatarUrl?: string;
} | null {
  const key = authorKeyFromEmail(email);
  const profiles = loadProfiles();
  const row = profiles[key];
  if (!row?.nick || row.nick.trim().length < 2) return null;
  const hasAvatar = Boolean(row.avatarFile) || Boolean(resolveAvatarPath(key));
  return {
    nick: row.nick.trim().slice(0, 32),
    babyName: (row.babyName || "").trim().slice(0, 24),
    babyBirth: (row.babyBirth || "").trim(),
    avatarUrl: hasAvatar ? `/api/community/avatar/${key}` : undefined,
  };
}

export function upsertCommunityProfile(input: {
  email: string;
  nick: string;
  babyName?: string;
  babyBirth?: string;
  avatarDataUrl?: string;
}): { ok: true } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Нужна почта" };
  }
  const nick = input.nick.trim().slice(0, 32);
  if (nick.length < 2) {
    return { ok: false, error: "Имя — минимум 2 буквы" };
  }
  const key = authorKeyFromEmail(email);
  if (input.avatarDataUrl?.startsWith("data:image/")) {
    const saved = saveAuthorAvatar(key, input.avatarDataUrl);
    if (!saved) return { ok: false, error: "Фото слишком большое" };
  }
  const profiles = loadProfiles();
  profiles[key] = {
    ...profiles[key],
    nick,
    babyName: (input.babyName || "").trim().slice(0, 24),
    babyBirth: (input.babyBirth || "").trim().slice(0, 16),
    updatedAt: new Date().toISOString(),
  };
  saveProfiles(profiles);
  return { ok: true };
}

export function getCommunityNickByAuthorKey(
  authorKey: string,
): string | undefined {
  const nick = loadProfiles()[authorKey]?.nick?.trim();
  return nick && nick.length >= 2 ? nick.slice(0, 32) : undefined;
}

export function avatarContentType(path: string): string {
  const ext = path.split(".").pop() || "jpg";
  return mimeFromExt(ext);
}
