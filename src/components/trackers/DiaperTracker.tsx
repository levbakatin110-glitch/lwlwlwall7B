"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";

const KINDS = [
  {
    id: "wet",
    label: "Мокрый",
    emoji: "💧",
    tone: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  },
  {
    id: "dirty",
    label: "Грязный",
    emoji: "💩",
    tone: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  },
  {
    id: "both",
    label: "Оба",
    emoji: "💦",
    tone: "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  },
  {
    id: "dry",
    label: "Сухой / проверка",
    emoji: "✨",
    tone: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  },
] as const;

export function DiaperTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const entries = useAppStore((s) => s.journals.diaper ?? []);
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("wet");
  const [rash, setRash] = useState(false);
  const [note, setNote] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return entries.filter((e) => e.date === today).length;
  }, [entries]);

  const byKind = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map = { wet: 0, dirty: 0, both: 0, dry: 0 };
    for (const e of entries) {
      if (e.date !== today) continue;
      const k = String(e.fields?.kind || "");
      if (k in map) map[k as keyof typeof map] += 1;
    }
    return map;
  }, [entries]);

  function save() {
    const meta = KINDS.find((k) => k.id === kind)!;
    const parts: string[] = [meta.label];
    if (rash) parts.push("раздражение");
    addJournalEntry("diaper", {
      date: new Date().toISOString().slice(0, 10),
      value: parts.join(" · "),
      note: note.trim(),
      fields: {
        kind,
        rash: rash ? 1 : 0,
      },
    });
    setNote("");
    setRash(false);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  }

  return (
    <div className="maya-rise overflow-hidden rounded-[1.5rem] border border-line bg-card/80 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Смена подгузника
          </h2>
          <p className="mt-1 text-xs text-muted">
            Сегодня уже {todayCount}{" "}
            {todayCount === 1 ? "раз" : todayCount < 5 ? "раза" : "раз"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={`rounded-2xl border px-3 py-4 text-left transition ${
              kind === k.id
                ? "border-accent bg-accent-soft ring-1 ring-accent/30"
                : "border-line bg-card/50 hover:border-accent/25"
            }`}
          >
            <span className="text-2xl" aria-hidden>
              {k.emoji}
            </span>
            <p className="mt-2 text-sm font-semibold">{k.label}</p>
            <p className="mt-0.5 text-[11px] text-muted">
              сегодня {byKind[k.id]}
            </p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRash((v) => !v)}
        className={`mt-3 w-full rounded-xl border px-3 py-2.5 text-left text-sm ${
          rash
            ? "border-blush/40 bg-blush-soft text-foreground"
            : "border-line text-muted"
        }`}
      >
        {rash ? "⚠️ Есть раздражение / опрелость" : "Отметить раздражение?"}
      </button>

      <label className="mt-3 block text-sm">
        <span className="text-xs text-muted">Заметка</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="крем, размер, что угодно…"
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
        />
      </label>

      <button
        type="button"
        onClick={save}
        className="mt-4 w-full rounded-2xl bg-accent py-3 text-sm font-semibold text-on-accent"
      >
        {savedFlash ? "Записано ✓" : "Сохранить смену"}
      </button>
    </div>
  );
}
