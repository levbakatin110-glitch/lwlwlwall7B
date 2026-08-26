/**
 * Надёжное хранилище для zustand persist:
 * localStorage сразу (синхронно) + зеркало в IndexedDB в фоне.
 *
 * Важно: hydrate не ждёт IndexedDB — иначе экран «Мая…» зависает
 * (Яндекс/часть браузеров).
 *
 * Запись дебаунсится и ловит QuotaExceeded / OOM при stringify —
 * иначе вкладка падает с «This page couldn't load» после записи в дневник.
 */

import type { PersistStorage, StateStorage, StorageValue } from "zustand/middleware";
import { writeIdentityBackup } from "./identity-backup";

const DB_NAME = "maya-durable-v1";
const STORE = "kv";
const THEME_KEY = "maya-theme";
const WRITE_DEBOUNCE_MS = 280;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      () => {
        window.clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return withTimeout(
    new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
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
    }),
    600,
    null,
  );
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  return withTimeout(
    new Promise<string | null>((resolve) => {
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
    }),
    600,
    null,
  );
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await withTimeout(
    new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    }),
    800,
    undefined,
  );
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await withTimeout(
    new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    }),
    800,
    undefined,
  );
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

function syncIdentityFromPersistValue(name: string, value: string) {
  if (name !== "maya-mom-ai") return;
  try {
    const parsed = JSON.parse(value) as {
      state?: {
        onboardingDone?: boolean;
        accountEmail?: string | null;
        emailVerified?: boolean;
        profile?: { name?: string };
        children?: { id?: string; name?: string }[];
        activeChildId?: string;
        theme?: string;
      };
    };
    const s = parsed.state;
    if (!s) return;
    const active =
      s.children?.find((c) => c.id === s.activeChildId) || s.children?.[0];
    const childName = s.profile?.name || active?.name;
    if (s.onboardingDone || s.accountEmail || s.emailVerified) {
      writeIdentityBackup({
        onboardingDone: Boolean(s.onboardingDone),
        email: s.accountEmail ?? null,
        emailVerified: Boolean(s.emailVerified),
        childName,
      });
    }
    if (s.theme === "dark" || s.theme === "blush") {
      try {
        localStorage.setItem(THEME_KEY, s.theme);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

export const durableStateStorage: StateStorage = {
  /**
   * Синхронно, если есть localStorage — hydrate не зависает.
   * IndexedDB только если LS пуст (и с таймаутом).
   */
  getItem: (name) => {
    const fromLs = lsGet(name);
    if (looksLikeStore(fromLs)) {
      void idbSet(name, fromLs!);
      return fromLs;
    }

    return idbGet(name).then((fromIdb) => {
      if (looksLikeStore(fromIdb)) {
        lsSet(name, fromIdb!);
        return fromIdb;
      }
      return fromLs;
    });
  },

  setItem: (name, value) => {
    const ok = lsSet(name, value);
    void idbSet(name, value);
    if (!ok) {
      console.warn("[maya] localStorage full — пробую IndexedDB");
    }
    syncIdentityFromPersistValue(name, value);
  },

  removeItem: (name) => {
    lsDel(name);
    void idbDel(name);
  },
};

type PersistPayload = StorageValue<unknown>;

/**
 * Обёртка над StateStorage: безопасный JSON + debounce записей.
 * Без этого stringify огромного стора (фото в гардеробе/моментах) на каждом
 * addJournalEntry иногда роняет вкладку Яндекс/Chrome.
 */
export function createSafePersistStorage(
  getStorage: () => StateStorage,
): PersistStorage<unknown> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { name: string; value: PersistPayload } | null = null;

  function flush() {
    timer = null;
    const job = pending;
    pending = null;
    if (!job) return;
    try {
      const storage = getStorage();
      const raw = JSON.stringify(job.value);
      storage.setItem(job.name, raw);
    } catch (err) {
      console.warn("[maya] persist skip (quota/OOM)", err);
    }
  }

  return {
    getItem: (name) => {
      try {
        const storage = getStorage();
        const raw = storage.getItem(name);
        if (raw == null) return null;
        if (raw instanceof Promise) {
          return raw.then((s) => {
            if (!s) return null;
            try {
              return JSON.parse(s) as PersistPayload;
            } catch {
              return null;
            }
          });
        }
        try {
          return JSON.parse(raw) as PersistPayload;
        } catch {
          return null;
        }
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pending = { name, value };
      if (timer != null) clearTimeout(timer);
      if (typeof window === "undefined") {
        flush();
        return;
      }
      timer = setTimeout(flush, WRITE_DEBOUNCE_MS);
    },
    removeItem: (name) => {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
      try {
        getStorage().removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

export { THEME_KEY };
