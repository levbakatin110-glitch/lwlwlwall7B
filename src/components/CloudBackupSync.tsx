"use client";

import { useEffect, useRef } from "react";
import { ensureChildSpace } from "@/lib/children";
import { mergeBackupData, storeHasBackupWorthyData } from "@/lib/backup-merge";
import { flushDurablePersist, waitPersistWritesAllowed } from "@/lib/durable-storage";
import {
  loadChatMessages,
  pickBestChatMessages,
  saveChatMessages,
} from "@/lib/chat-persist";
import { remirrorJournalsFromSpaces, useAppStore } from "@/lib/store";

function buildBackupPayload() {
  const s = useAppStore.getState();
  return {
    children: s.children,
    activeChildId: s.activeChildId,
    childSpaces: Object.fromEntries(
      Object.entries(s.childSpaces ?? {}).map(([id, sp]) => {
        const best = pickBestChatMessages(
          id,
          sp.messages?.length ? sp.messages : loadChatMessages(id),
        );
        return [
          id,
          {
            ...sp,
            messages: best.slice(-150),
          },
        ];
      }),
    ),
    onboardingDone: s.onboardingDone,
    pregnancy: s.pregnancy,
    momJournals: s.momJournals,
    enabledModules: s.enabledModules,
    customModules: s.customModules,
    dietPlan: s.dietPlan,
  };
}

function syncChatMirror(
  childSpaces: Record<string, ReturnType<typeof ensureChildSpace>>,
  activeChildId: string,
) {
  const id = activeChildId;
  const sp = ensureChildSpace(childSpaces[id]);
  const best = pickBestChatMessages(id, sp.messages ?? []);
  saveChatMessages(id, best);
  return {
    childSpaces: { ...childSpaces, [id]: { ...sp, messages: best } },
    messages: best,
  };
}

function isLocalStoreEmpty(local: ReturnType<typeof useAppStore.getState>): boolean {
  if (loadChatMessages(local.activeChildId).length > 0) return false;
  return !storeHasBackupWorthyData({
    childSpaces: local.childSpaces,
    momJournals: local.momJournals,
    customModules: local.customModules,
    pregnancy: local.pregnancy,
  });
}

function applyBackupPayload(payload: Record<string, unknown>) {
  useAppStore.setState((prev) => {
    const merged = mergeBackupData(
      {
        children: prev.children,
        activeChildId: prev.activeChildId,
        childSpaces: prev.childSpaces,
        momJournals: prev.momJournals,
        customModules: prev.customModules,
        pregnancy: prev.pregnancy,
      },
      payload,
    );
    const nextChildSpaces = (merged.childSpaces ??
      prev.childSpaces) as typeof prev.childSpaces;
    const activeId = String(merged.activeChildId ?? prev.activeChildId);
    const chatSync = syncChatMirror(nextChildSpaces, activeId);
    return {
      ...prev,
      ...(Array.isArray(merged.children) && merged.children.length > 0
        ? { children: merged.children as typeof prev.children }
        : {}),
      activeChildId: activeId,
      childSpaces: chatSync.childSpaces,
      messages: chatSync.messages,
      ...(merged.pregnancy
        ? { pregnancy: merged.pregnancy as typeof prev.pregnancy }
        : {}),
      momJournals: (merged.momJournals ??
        prev.momJournals) as typeof prev.momJournals,
      ...(merged.enabledModules
        ? {
            enabledModules:
              merged.enabledModules as typeof prev.enabledModules,
          }
        : {}),
      ...(merged.customModules
        ? {
            customModules:
              merged.customModules as typeof prev.customModules,
          }
        : {}),
      ...(merged.dietPlan !== undefined
        ? { dietPlan: merged.dietPlan as typeof prev.dietPlan }
        : {}),
      onboardingDone: Boolean(merged.onboardingDone ?? true),
    };
  });
  remirrorJournalsFromSpaces();
  flushDurablePersist();
  if (useAppStore.getState().onboardingDone) {
    useAppStore.getState().completeOnboarding();
  }
}

let restoreInFlight: Promise<boolean> | null = null;
/** PUT только после успешного GET бэкапа (сессия есть). Иначе пустой комп затрёт телефон. */
let backupPullDone = false;

function waitHydration(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (useAppStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useAppStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
    window.setTimeout(() => {
      unsub();
      resolve();
    }, 2500);
  });
}

/** Подтянуть облачный бэкап и склеить с тем, что уже на телефоне. */
export async function restoreCloudBackup(opts?: {
  force?: boolean;
}): Promise<boolean> {
  if (restoreInFlight && !opts?.force) return restoreInFlight;
  const run = (async () => {
    try {
      await waitHydration();
      await waitPersistWritesAllowed();
      const res = await fetch("/api/backup", { credentials: "include" });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        backup?: { data?: Record<string, unknown> } | null;
      };
      const payload = data.backup?.data;
      if (payload) applyBackupPayload(payload);
      backupPullDone = true;
      return Boolean(payload);
    } catch {
      return false;
    }
  })();
  restoreInFlight = run;
  try {
    return await run;
  } finally {
    if (restoreInFlight === run) restoreInFlight = null;
  }
}

async function hasSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (!res.ok) return false;
    const data = (await res.json()) as { email?: string | null };
    return Boolean(data.email);
  } catch {
    return false;
  }
}

async function pushBackup(): Promise<void> {
  if (!backupPullDone) return;
  const local = useAppStore.getState();
  if (isLocalStoreEmpty(local)) return;
  try {
    await fetch("/api/backup", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backup: buildBackupPayload() }),
    });
  } catch {
    /* ignore */
  }
}

/** Облачный бэкап дневников на VPS (по сессии). */
export function CloudBackupSync() {
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const accountEmail = useAppStore((s) => s.accountEmail);
  const momJournals = useAppStore((s) => s.momJournals);
  const childSpaces = useAppStore((s) => s.childSpaces);
  const pushed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    void (async () => {
      if (!(await hasSession())) {
        return;
      }
      if (cancelled) return;
      await waitHydration();
      if (cancelled) return;
      await restoreCloudBackup();
      if (cancelled) return;
      if (!useAppStore.getState().onboardingDone) return;
      if (!pushed.current) {
        pushed.current = true;
        await pushBackup();
      }
      intervalId = window.setInterval(() => void pushBackup(), 3 * 60_000);
    })();

    return () => {
      cancelled = true;
      if (intervalId != null) window.clearInterval(intervalId);
    };
  }, [onboardingDone, accountEmail]);

  useEffect(() => {
    if (!onboardingDone || !accountEmail) return;
    if (!useAppStore.persist.hasHydrated()) return;
    const t = window.setTimeout(() => {
      if (!backupPullDone) return;
      void pushBackup();
    }, 1200);
    return () => window.clearTimeout(t);
  }, [onboardingDone, accountEmail, momJournals, childSpaces]);

  return null;
}
