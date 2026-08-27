"use client";

import { useEffect, useRef } from "react";
import { ensureChildSpace } from "@/lib/children";
import {
  loadChatMessages,
  pickBestChatMessages,
  saveChatMessages,
} from "@/lib/chat-persist";
import { useAppStore } from "@/lib/store";

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

/** Облачный бэкап дневников на VPS (по сессии). */
export function CloudBackupSync() {
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const restored = useRef(false);

  useEffect(() => {
    if (!onboardingDone) return;
    let cancelled = false;
    let intervalId: number | null = null;

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

    async function restoreOnce(): Promise<boolean> {
      if (restored.current) return true;
      try {
        const res = await fetch("/api/backup", { credentials: "include" });
        if (!res.ok) return false;
        if (cancelled) return false;
        const data = (await res.json()) as {
          backup?: { data?: Record<string, unknown> } | null;
        };
        const payload = data.backup?.data;
        if (!payload) {
          restored.current = true;
          return true;
        }
        const local = useAppStore.getState();
        if (!isLocalStoreEmpty(local)) {
          restored.current = true;
          return true;
        }
        useAppStore.setState((prev) => {
          const nextChildSpaces = {
            ...prev.childSpaces,
            ...(payload.childSpaces
              ? (payload.childSpaces as typeof prev.childSpaces)
              : {}),
          };
          const activeId = String(
            payload.activeChildId ?? prev.activeChildId,
          );
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
            onboardingDone: Boolean(
              payload.onboardingDone ?? prev.onboardingDone,
            ),
          };
        });
        restored.current = true;
        return true;
      } catch {
        return false;
      }
    }

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
      const ok = await restoreOnce();
      if (!ok || cancelled) return;
      await push();
      intervalId = window.setInterval(() => void push(), 3 * 60_000);
    })();

    return () => {
      cancelled = true;
      if (intervalId != null) window.clearInterval(intervalId);
    };
  }, [onboardingDone]);

  return null;
}
