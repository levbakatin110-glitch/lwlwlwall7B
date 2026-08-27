import type { ChatMessage } from "./types";

const MAX = 200;

function key(childId: string) {
  return `maya-chat-${childId}`;
}

function canUse() {
  return typeof window !== "undefined";
}

/** Отдельное хранилище чата — не режется при slim основного стора */
export function loadChatMessages(childId: string): ChatMessage[] {
  if (!canUse() || !childId) return [];
  try {
    const raw = localStorage.getItem(key(childId));
    if (!raw) return [];
    const data = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(data) ? data.slice(-MAX) : [];
  } catch {
    return [];
  }
}

export function saveChatMessages(
  childId: string,
  messages: ChatMessage[],
): void {
  if (!canUse() || !childId) return;
  try {
    const slim = (messages ?? []).slice(-MAX).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    }));
    localStorage.setItem(key(childId), JSON.stringify(slim));
  } catch {
    /* quota */
  }
}

/** Берём более полную историю: из стора или отдельного ключа */
export function pickBestChatMessages(
  childId: string,
  fromSpace: ChatMessage[],
): ChatMessage[] {
  const saved = loadChatMessages(childId);
  const space = fromSpace ?? [];
  if (saved.length > space.length) return saved;
  if (space.length > 0) {
    saveChatMessages(childId, space);
    return space;
  }
  return saved;
}

export function clearAllChatPersist(): void {
  if (!canUse()) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("maya-chat-")) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
