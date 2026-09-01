/** Живые таймеры: localStorage, чтобы не сбрасывались при закрытии вкладки. */

export function liveGet(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function liveSet(key: string, value: string | null) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* */
  }
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* */
  }
}

export function liveParse<T>(key: string): T | null {
  const raw = liveGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const LIVE_KEYS = {
  sleep: "maya-sleep-session",
  bf: "maya-bf-session",
  walk: "maya-walk-session",
  contractions: "maya-contractions-session",
  kicks: "maya-kicks-session",
} as const;

export function sleepLiveKey(journalId: string): string {
  return journalId === "sleep"
    ? LIVE_KEYS.sleep
    : `${LIVE_KEYS.sleep}-${journalId}`;
}
