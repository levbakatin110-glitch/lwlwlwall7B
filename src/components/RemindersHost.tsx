"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { collectScheduledPushes } from "@/components/CareRemindersSync";
import { notifyViaSw } from "@/components/PushReminders";
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

type DueItem = {
  id: string;
  text: string;
  href: string;
};

export function RemindersHost() {
  const childSpaces = useAppStore((s) => s.childSpaces);
  const journals = useAppStore((s) => s.journals);
  const momJournals = useAppStore((s) => s.momJournals);
  const [due, setDue] = useState<DueItem[]>([]);

  const tickKey = useMemo(() => {
    return `${Object.keys(childSpaces ?? {}).length}:${journals?.notes?.length ?? 0}:${momJournals?.preg_meds?.length ?? 0}`;
  }, [childSpaces, journals, momJournals]);

  useEffect(() => {
    function check() {
      const fired = loadFired();
      const now = Date.now();
      const fresh: DueItem[] = [];
      const items = collectScheduledPushes(now).sort((a, b) => a.nextAt - b.nextAt);
      for (const c of items) {
        if (c.nextAt > now) continue;
        if (c.nextAt < now - 24 * 60 * 60 * 1000) continue;
        const slot = `${c.id}:${Math.floor(c.nextAt / 60_000)}`;
        if (fired.has(c.id) || fired.has(slot)) continue;
        if (fresh.length >= 5) break;
        fired.add(slot);
        if (c.mode === "once") fired.add(c.id);
        fresh.push({ id: slot, text: c.body, href: c.url });
        notifyViaSw({
          title: c.title,
          body: c.body,
          tag: c.tag,
          url: c.url,
        });
      }
      if (fresh.length) {
        saveFired(fired);
        setDue((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...fresh.filter((f) => !ids.has(f.id)), ...prev].slice(0, 5);
        });
      }
    }
    check();
    const id = window.setInterval(check, 20_000);
    return () => window.clearInterval(id);
  }, [tickKey]);

  if (due.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-3 md:bottom-6">
      {due.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-accent/30 bg-card/95 px-4 py-3 shadow-lg backdrop-blur-xl"
        >
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"
            aria-hidden
          >
            <MayaIcon name="health" size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              Напоминание
            </p>
            <p className="mt-0.5 text-sm font-medium leading-snug">{item.text}</p>
            <Link
              href={item.href}
              className="mt-1 inline-block text-[11px] font-semibold text-accent"
            >
              Открыть
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setDue((prev) => prev.filter((d) => d.id !== item.id))}
            className="text-xs text-muted hover:text-foreground"
          >
            Ок
          </button>
        </div>
      ))}
    </div>
  );
}
