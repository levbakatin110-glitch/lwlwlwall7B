"use client";

import { useEffect, useRef } from "react";
import { ensureChildSpace } from "@/lib/children";
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
  const hasNamedChild = local.children.some((c) => Boolean(c.name?.trim()));
  const hasDiaryData = Object.values(local.childSpaces ?? {}).some((sp) => {
    if ((sp.messages?.length ?? 0) > 0) return true;
    if (loadChatMessages(local.activeChildId).length > 0) return true;
    return Object.values(sp.journals ?? {}).some(
      (j) => Array.isArray(j) && j.length > 0,
    );
  });
  const hasCustomModules = (local.customModules?.length ?? 0) > 0;
  const hasMomJournals = Object.keys(local.momJournals ?? {}).length > 0;
  const hasPregnancy = Boolean(
    local.pregnancy?.active ||
      local.pregnancy?.dueDate ||
      local.pregnancy?.lmpDate,
  );
  return (
    !hasNamedChild &&
    !hasDiaryData &&
    !hasCustomModules &&
    !hasMomJournals &&
    !hasPregnancy
  );
}

function applyBackupPayload(payload: Record<string, unknown>) {
  useAppStore.setState((prev) => {
    const nextChildSpaces = {
      ...prev.childSpaces,
      ...(payload.childSpaces
        ? (payload.childSpaces as typeof prev.childSpaces)
        : {}),
    };
    const activeId = String(payload.activeChildId ?? prev.activeChildId);
    const chatSync = syncChatMirror(nextChildSpaces, activeId);
    return {
      ...prev,
      ...(payload.children
        ? { children: payload.children as typeof prev.children }
        : {}),
      activeChildId: activeId,
      childSpaces: chatSync.childSpaces,
      messages: chatSync.messages,
      ...(payload.pregnancy
        ? { pregnancy: payload.pregnancy as typeof prev.pregnancy }
        : {}),
      ...(payload.momJournals
        ? { momJournals: payload.momJournals as typeof prev.momJournals }
        : {}),
      ...(payload.enabledModules
        ? {
            enabledModules:
              payload.enabledModules as typeof prev.enabledModules,
          }
        : {}),
      ...(payload.customModules
        ? {
            customModules:
              payload.customModules as typeof prev.customModules,
          }
        : {}),
      ...(payload.dietPlan !== undefined
        ? { dietPlan: payload.dietPlan as typeof prev.dietPlan }
        : {}),
      onboardingDone: Boolean(payload.onboardingDone ?? true),
    };
  });
  remirrorJournalsFromSpaces();
  if (useAppStore.getState().onboardingDone) {
    useAppStore.getState().completeOnboarding();
  }
}

let restoreInFlight: Promise<boolean> | null = null;

/** Подтянуть облачный бэкап в пустой стор (иконка на рабочем столе / другой браузер). */
export async function restoreCloudBackup(opts?: {
  force?: boolean;
}): Promise<boolean> {
  if (restoreInFlight && !opts?.force) return restoreInFlight;
  const run = (async () => {
    try {
      const res = await fetch("/api/backup", { credentials: "include" });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        backup?: { data?: Record<string, unknown> } | null;
      };
      const payload = data.backup?.data;
      if (!payload) return false;
      const local = useAppStore.getState();
      if (!opts?.force && !isLocalStoreEmpty(local)) return true;
      applyBackupPayload(payload);
      return true;
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

/** Облачный бэкап дневников на VPS (по сессии). */
export function CloudBackupSync() {
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const accountEmail = useAppStore((s) => s.accountEmail);
  const pushed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    async function push() {
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

    void (async () => {
      if (!(await hasSession())) return;
      if (cancelled) return;
      await restoreCloudBackup();
      if (cancelled) return;
      if (!useAppStore.getState().onboardingDone) return;
      if (!pushed.current) {
        pushed.current = true;
        await push();
      }
      intervalId = window.setInterval(() => void push(), 3 * 60_000);
    })();

    return () => {
      cancelled = true;
      if (intervalId != null) window.clearInterval(intervalId);
    };
  }, [onboardingDone, accountEmail]);

  return null;
}
