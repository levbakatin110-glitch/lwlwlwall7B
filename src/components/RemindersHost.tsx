"use client";

import { useEffect, useMemo } from "react";
import { collectScheduledPushes } from "@/components/CareRemindersSync";
import { notifyViaSw } from "@/components/PushReminders";
import { minGapAfterFireMs } from "@/lib/care-reminders";
import { useAppStore } from "@/lib/store";

const FIRED_KEY = "maya-reminders-fired-v1";

function loadFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveFired(set: Set<string>) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-160)));
  } catch {
    /* ignore */
  }
}

function lookingAtMaya(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

/** Тихо шлёт системный пуш, если вкладка свёрнута. На открытом сайте ничего не рисует. */
export function RemindersHost() {
  const childSpaces = useAppStore((s) => s.childSpaces);
  const journals = useAppStore((s) => s.journals);
  const momJournals = useAppStore((s) => s.momJournals);

  const tickKey = useMemo(() => {
    return `${Object.keys(childSpaces ?? {}).length}:${journals?.notes?.length ?? 0}:${momJournals?.preg_meds?.length ?? 0}`;
  }, [childSpaces, journals, momJournals]);

  useEffect(() => {
    function check() {
      if (lookingAtMaya()) return;
      const fired = loadFired();
      const now = Date.now();
      let n = 0;
      const items = collectScheduledPushes(now).sort((a, b) => a.nextAt - b.nextAt);
      for (const c of items) {
        if (c.nextAt > now) continue;
        if (c.nextAt < now - 24 * 60 * 60 * 1000) continue;
        const gapMs = minGapAfterFireMs(c);
        const slot = `${c.id}:${Math.floor(c.nextAt / gapMs)}`;
        if (fired.has(c.id) || fired.has(slot)) continue;
        if (n >= 5) break;
        fired.add(slot);
        if (c.mode === "once") fired.add(c.id);
        n += 1;
        notifyViaSw({
          title: c.title,
          body: c.body,
          tag: c.tag,
          url: c.url,
        });
      }
      if (n) saveFired(fired);
    }
    check();
    const id = window.setInterval(check, 20_000);
    return () => window.clearInterval(id);
  }, [tickKey]);

  return null;
}
