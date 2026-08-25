/**
 * Надёжное хранилище для zustand persist:
 * localStorage + зеркало в IndexedDB.
 *
 * Ярлык / PWA иногда открывается в контексте, где localStorage пуст
 * или переполнен — IndexedDB чаще переживает и восстанавливает профиль.
 */

import type { StateStorage } from "zustand/middleware";
import { writeIdentityBackup } from "./identity-backup";

const DB_NAME = "maya-durable-v1";
const STORE = "kv";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = req.result;
        resolve(typeof v === "string" ? v : v == null ? null : String(v));
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function lsGet(name: string): string | null {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function lsSet(name: string, value: string): boolean {
  try {
    localStorage.setItem(name, value);
    return true;
  } catch {
    return false;
  }
}

function lsDel(name: string): void {
  try {
    localStorage.removeItem(name);
  } catch {
    /* ignore */
  }
}

function looksLikeStore(raw: string | null): raw is string {
  if (!raw || raw.length < 20) return false;
  try {
    const parsed = JSON.parse(raw) as { state?: unknown };
    return Boolean(parsed && typeof parsed === "object" && parsed.state);
  } catch {
    return false;
  }
}

/** Есть ли смысл предпочесть этот снимок (не «пустой» первый заход) */
function storeScore(raw: string): number {
  try {
    const parsed = JSON.parse(raw) as {
      state?: {
        onboardingDone?: boolean;
        accountEmail?: string | null;
        profile?: { name?: string; birthDate?: string };
        children?: { name?: string; birthDate?: string }[];
        messages?: unknown[];
      };
    };
    const s = parsed.state;
    if (!s) return 0;
    let score = 0;
    if (s.onboardingDone) score += 100;
    if (s.accountEmail) score += 40;
    if (s.profile?.name?.trim() || s.profile?.birthDate) score += 30;
    if (s.children?.some((c) => c.name?.trim() || c.birthDate)) score += 30;
    if ((s.messages?.length ?? 0) > 0) score += 20;
    score += Math.min(50, Math.floor(raw.length / 2000));
    return score;
  } catch {
    return 0;
  }
}

export const durableStateStorage: StateStorage = {
  getItem: async (name) => {
    const fromLs = lsGet(name);
    const fromIdb = await idbGet(name);

    const lsOk = looksLikeStore(fromLs);
    const idbOk = looksLikeStore(fromIdb);

    if (lsOk && idbOk) {
      const prefer =
        storeScore(fromLs!) >= storeScore(fromIdb!) ? fromLs! : fromIdb!;
      // синхронизировать обе копии
      if (prefer !== fromLs) lsSet(name, prefer);
      if (prefer !== fromIdb) void idbSet(name, prefer);
      return prefer;
    }

    if (lsOk) {
      void idbSet(name, fromLs!);
      return fromLs;
    }

    if (idbOk) {
      lsSet(name, fromIdb!);
      return fromIdb;
    }

    return fromLs ?? fromIdb;
  },

  setItem: async (name, value) => {
    const ok = lsSet(name, value);
    await idbSet(name, value);
    if (!ok) {
      console.warn(
        "[maya] localStorage full — профиль сохранён в IndexedDB",
      );
    }
    // Обновляем лёгкий паспорт при каждом сохранении стора
    if (name === "maya-mom-ai") {
      try {
        const parsed = JSON.parse(value) as {
          state?: {
            onboardingDone?: boolean;
            accountEmail?: string | null;
            emailVerified?: boolean;
            profile?: { name?: string };
          };
        };
        const s = parsed.state;
        if (s && (s.onboardingDone || s.accountEmail || s.emailVerified)) {
          writeIdentityBackup({
            onboardingDone: Boolean(s.onboardingDone),
            email: s.accountEmail ?? null,
            emailVerified: Boolean(s.emailVerified),
            childName: s.profile?.name,
          });
        }
      } catch {
        /* ignore */
      }
    }
  },

  removeItem: async (name) => {
    lsDel(name);
    await idbDel(name);
  },
};
