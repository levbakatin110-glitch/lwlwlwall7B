"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-80)));
  } catch {
    /* ignore */
  }
}

type DueItem = {
  id: string;
  text: string;
  at: string;
};

export function RemindersHost() {
  const entries = useAppStore((s) => s.journals.notes ?? []);
  const [due, setDue] = useState<DueItem[]>([]);

  const candidates = useMemo(() => {
    return entries
      .map((e) => {
        const at = String(e.fields?.remindAt || "");
        if (!at) return null;
        const t = new Date(at).getTime();
        if (!Number.isFinite(t)) return null;
        return {
          id: e.id,
          text: String(e.fields?.text || e.note || e.value),
          at,
          t,
        };
      })
      .filter(Boolean) as { id: string; text: string; at: string; t: number }[];
  }, [entries]);

  useEffect(() => {
    function check() {
      const fired = loadFired();
      const now = Date.now();
      const fresh: DueItem[] = [];
      for (const c of candidates) {
        if (c.t > now) continue;
        if (c.t < now - 24 * 60 * 60 * 1000) continue;
        if (fired.has(c.id)) continue;
        fired.add(c.id);
        fresh.push({ id: c.id, text: c.text, at: c.at });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification("Мая · напоминание", {
              body: c.text,
              tag: c.id,
            });
          } catch {
            /* ignore */
          }
        }
      }
      if (fresh.length) {
        saveFired(fired);
        setDue((prev) => [...fresh, ...prev].slice(0, 5));
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
          <span className="text-xl" aria-hidden>
            ⏰
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              Напоминание
            </p>
            <p className="mt-0.5 text-sm font-medium leading-snug">{item.text}</p>
            <Link
              href="/m/notes"
              className="mt-1 inline-block text-[11px] font-semibold text-accent"
            >
              Открыть заметки
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
