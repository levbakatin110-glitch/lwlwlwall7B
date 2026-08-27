"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { notifyViaSw } from "@/components/PushReminders";

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
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-120)));
  } catch {
    /* ignore */
  }
}

type DueItem = {
  id: string;
  text: string;
  at: string;
  href: string;
};

function collectFromJournal(
  entries: {
    id: string;
    value: string;
    note: string;
    fields?: Record<string, string | number>;
  }[],
  href: string,
): { id: string; text: string; at: string; t: number; href: string }[] {
  return entries
    .map((e) => {
      if (e.fields?.taken) return null;
      const at = String(e.fields?.remindAt || "");
      if (!at) return null;
      const t = new Date(at).getTime();
      if (!Number.isFinite(t)) return null;
      return {
        id: `${href}-${e.id}`,
        text: String(e.fields?.text || e.note || e.value),
        at,
        t,
        href,
      };
    })
    .filter(Boolean) as {
    id: string;
    text: string;
    at: string;
    t: number;
    href: string;
  }[];
}

export function RemindersHost() {
  const notes = useAppStore((s) => s.journals?.notes ?? []);
  const meds = useAppStore((s) => s.journals?.preg_meds ?? []);
  const [due, setDue] = useState<DueItem[]>([]);

  const candidates = useMemo(() => {
    return [
      ...collectFromJournal(notes, "/m/notes"),
      ...collectFromJournal(meds, "/m/preg_meds"),
    ];
  }, [notes, meds]);

  useEffect(() => {
    function check() {
      const fired = loadFired();
      const now = Date.now();
      const fresh: DueItem[] = [];
      const sorted = [...candidates].sort((a, b) => a.t - b.t);
      for (const c of sorted) {
        if (c.t > now) continue;
        if (c.t < now - 24 * 60 * 60 * 1000) continue;
        if (fired.has(c.id)) continue;
        // Не больше 5 тостов за раз — остальные дожмутся на следующем тике
        if (fresh.length >= 5) break;
        fired.add(c.id);
        fresh.push({ id: c.id, text: c.text, at: c.at, href: c.href });
        notifyViaSw({
          title: "Мая · напоминание",
          body: c.text,
          tag: c.id,
          url: c.href,
        });
      }
      if (fresh.length) {
        saveFired(fired);
        setDue((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const merged = [...fresh.filter((f) => !ids.has(f.id)), ...prev];
          return merged.slice(0, 5);
        });
      }
    }
    check();
    const id = window.setInterval(check, 20_000);
    return () => window.clearInterval(id);
  }, [candidates]);

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
