/**
 * Надёжное хранилище для zustand persist.
 *
 * Главная причина «This page couldn't load» в Яндексе — раздутый
 * maya-mom-ai (фото base64 + дубли journals/messages). При чтении/записи
 * стор ужимаем; в layout есть аварийный скрипт до React.
 */

import type { PersistStorage, StateStorage, StorageValue } from "zustand/middleware";
import { writeIdentityBackup } from "./identity-backup";

const DB_NAME = "maya-durable-v1";
const STORE = "kv";
const THEME_KEY = "maya-theme";
const WRITE_DEBOUNCE_MS = 400;
/** Выше — режем base64 и дубли агрессивнее */
const HEAVY_CHARS = 500_000;
const MAX_DATA_URL = 12_000;
const MAX_MESSAGES = 100;
const MAX_MEMORIES = 20;
const MAX_WARDROBE = 25;

type PersistPayload = StorageValue<unknown>;

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

function stripHeavyDataUrl(v: unknown): unknown {
  if (typeof v !== "string") return v;
  if (v.startsWith("data:") && v.length > MAX_DATA_URL) return undefined;
  return v;
}

function slimChild(c: Record<string, unknown>) {
  const next = { ...c };
  const photo = stripHeavyDataUrl(next.photoData);
  if (photo === undefined) delete next.photoData;
  else next.photoData = photo;
  return next;
}

function slimSpace(sp: Record<string, unknown>, aggressive: boolean) {
  const next = { ...sp };
  const msgCap = aggressive ? 80 : MAX_MESSAGES;
  const memCap = aggressive ? 15 : MAX_MEMORIES;
  const wardCap = aggressive ? 20 : MAX_WARDROBE;

  if (Array.isArray(next.messages)) {
    next.messages = next.messages.slice(-msgCap).map((m: Record<string, unknown>) => {
      const row = { ...m };
      delete row.weather;
      return row;
    });
  }
  if (Array.isArray(next.wardrobe)) {
    next.wardrobe = next.wardrobe.slice(0, wardCap).map((w: Record<string, unknown>) => {
      const row = { ...w };
      const img = stripHeavyDataUrl(row.imageData);
      if (img === undefined) delete row.imageData;
      else row.imageData = img;
      const label = stripHeavyDataUrl(row.labelImageData);
      if (label === undefined) delete row.labelImageData;
      else row.labelImageData = label;
      return row;
    });
  }
  if (Array.isArray(next.memories)) {
    next.memories = next.memories.slice(0, memCap).map((m: Record<string, unknown>) => {
      const row = { ...m };
      const img = stripHeavyDataUrl(row.imageData);
      if (img === undefined) delete row.imageData;
      else row.imageData = img;
      return row;
    });
  }
  return next;
}

/**
 * Ужимает state внутри persist-payload (и старые дубли зеркал).
 * Возвращает тот же объект (мутация) для экономии памяти.
 */
export function slimPersistPayload(
  payload: PersistPayload,
  opts?: { aggressive?: boolean },
): PersistPayload {
  try {
    const state = payload.state as Record<string, unknown> | undefined;
    if (!state || typeof state !== "object") return payload;

    const aggressive = Boolean(opts?.aggressive);

    // старые зеркала — в childSpaces уже есть
    delete state.journals;
    delete state.messages;
    delete state.wardrobe;
    delete state.memories;
    delete state.memoryStory;
    delete state.profile;
    delete state.enabledModules;
    delete state.customModules;
    delete state.demoWardrobeSeeded;

    if (Array.isArray(state.children)) {
      state.children = state.children.map((c) =>
        slimChild(c as Record<string, unknown>),
      );
    }

    if (state.childSpaces && typeof state.childSpaces === "object") {
      const spaces = state.childSpaces as Record<string, Record<string, unknown>>;
      const out: Record<string, unknown> = {};
      for (const [id, sp] of Object.entries(spaces)) {
        out[id] = slimSpace(sp, aggressive);
      }
      state.childSpaces = out;
    }

    if (Array.isArray(state.opsErrors)) {
      state.opsErrors = state.opsErrors.slice(0, 20);
    }

    payload.state = state;
    return payload;
  } catch {
    return payload;
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

/** Аварийно ужать maya-mom-ai в localStorage (вызывать до React). */
export function emergencySlimLocalStore(): void {
  try {
    const raw = localStorage.getItem("maya-mom-ai");
    if (!raw || raw.length < HEAVY_CHARS) return;
    const parsed = JSON.parse(raw) as PersistPayload;
    slimPersistPayload(parsed, { aggressive: true });
    const next = JSON.stringify(parsed);
    localStorage.setItem("maya-mom-ai", next);
    void idbSet("maya-mom-ai", next);
  } catch {
    try {
      // крайний случай — лучше потерять тяжёлые фото, чем вкладку
      localStorage.removeItem("maya-mom-ai");
    } catch {
      /* ignore */
    }
  }
}

export const durableStateStorage: StateStorage = {
  /**
   * Синхронно из localStorage. IndexedDB не блокирует hydrate:
   * иначе после «удалил всё» огромный IDB снова вешает экран «Мая…».
   */
  getItem: (name) => {
    const fromLs = lsGet(name);
    if (looksLikeStore(fromLs)) {
      if (fromLs!.length >= HEAVY_CHARS && name === "maya-mom-ai") {
        try {
          emergencySlimLocalStore();
          const slimmed = lsGet(name);
          if (looksLikeStore(slimmed)) {
            void idbSet(name, slimmed!);
            return slimmed;
          }
        } catch {
          /* fall through */
        }
      } else {
        void idbSet(name, fromLs!);
      }
      return fromLs;
    }

    // LS пуст — hydrate сразу с нуля. Огромный IDB больше не возвращаем в LS
    // (иначе на следующий заход JSON.parse в layout убивает вкладку везде).
    void idbGet(name).then((fromIdb) => {
      if (!looksLikeStore(fromIdb)) return;
      if (name === "maya-mom-ai") {
        if (fromIdb!.length >= HEAVY_CHARS) {
          void idbDel(name);
          return;
        }
      }
      lsSet(name, fromIdb!);
    });

    return null;
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

function parseAndSlim(raw: string): PersistPayload | null {
  // Любой крупный blob — удаляем без parse (parse = OOM = «couldn't load» во всех браузерах)
  if (raw.length >= HEAVY_CHARS) {
    try {
      lsDel("maya-mom-ai");
      void idbDel("maya-mom-ai");
    } catch {
      /* ignore */
    }
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PersistPayload;
    slimPersistPayload(parsed, { aggressive: false });
    return parsed;
  } catch {
    try {
      lsDel("maya-mom-ai");
      void idbDel("maya-mom-ai");
    } catch {
      /* ignore */
    }
    return null;
  }
}

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
      slimPersistPayload(job.value, { aggressive: false });
      const storage = getStorage();
      let raw = JSON.stringify(job.value);
      if (raw.length >= HEAVY_CHARS) {
        slimPersistPayload(job.value, { aggressive: true });
        raw = JSON.stringify(job.value);
      }
      storage.setItem(job.name, raw);
    } catch (err) {
      console.warn("[maya] persist skip (quota/OOM)", err);
      try {
        // ещё раз жёстче
        if (job) {
          slimPersistPayload(job.value, { aggressive: true });
          getStorage().setItem(job.name, JSON.stringify(job.value));
        }
      } catch {
        /* ignore */
      }
    }
  }

  return {
    getItem: (name) => {
      try {
        if (name === "maya-mom-ai") {
          try {
            emergencySlimLocalStore();
          } catch {
            /* ignore */
          }
        }
        const storage = getStorage();
        const raw = storage.getItem(name);
        if (raw == null) return null;
        if (raw instanceof Promise) {
          return raw.then((s) => (s ? parseAndSlim(s) : null));
        }
        return parseAndSlim(raw);
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
