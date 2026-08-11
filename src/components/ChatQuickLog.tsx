"use client";

import Link from "next/link";
import { useAppStore } from "@/lib/store";
import type { ModuleId } from "@/lib/types";

const ACTIONS: {
  label: string;
  href: string;
  moduleId: ModuleId;
}[] = [
  { label: "+ Сон", href: "/m/sleep", moduleId: "sleep" },
  { label: "+ Кормление", href: "/m/breastfeeding", moduleId: "breastfeeding" },
  { label: "+ Подгузник", href: "/m/diaper", moduleId: "diaper" },
];

/** Крупные быстрые переходы к трекерам с главного чата */
export function ChatQuickLog() {
  const enableModule = useAppStore((s) => s.enableModule);
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);

  return (
    <div className="mx-3 mb-2 flex shrink-0 gap-2 overflow-x-auto pb-0.5">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          onClick={() => enableModule(a.moduleId)}
          className="shrink-0 rounded-full border border-line bg-accent-soft/70 px-3.5 py-2 text-xs font-semibold text-foreground transition hover:border-accent/40 hover:bg-accent-soft"
        >
          {a.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => {
          enableModule("diaper");
          addJournalEntry("diaper", {
            date: new Date().toISOString().slice(0, 10),
            value: "Мокрый",
            note: "",
            fields: { kind: "wet", rash: 0 },
          });
        }}
        className="shrink-0 rounded-full border border-line bg-card/80 px-3.5 py-2 text-xs font-medium text-muted transition hover:border-accent/35 hover:text-foreground"
      >
        Мокрый ✓
      </button>
    </div>
  );
}
