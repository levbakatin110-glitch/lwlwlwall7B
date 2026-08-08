"use client";

import { MayaIcon } from "@/components/icons/MayaIcon";

/** Единый чип «записано в дневник» — на всю ширину пузыря */
export function JournalEntryChip({
  title,
  value,
  eyebrow = "Записано",
  icon = "growth",
  onClick,
}: {
  title: string;
  value: string;
  eyebrow?: string;
  icon?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="maya-entry-chip maya-msg-in mt-3 flex w-full min-w-0 items-center justify-between gap-3 rounded-[var(--radius-card)] border border-accent/30 px-3.5 py-3.5 text-left transition hover:border-accent/50"
      style={{ background: "var(--chip-bg)", color: "var(--chip-fg)" }}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          {eyebrow}
        </span>
        <span className="mt-0.5 block text-sm font-medium">
          <span className="opacity-70">{title}:</span> {value}
        </span>
      </span>
      <MayaIcon name={icon} size={18} className="shrink-0 text-accent/80" />
    </Comp>
  );
}
