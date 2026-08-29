"use client";

import type { ReactNode } from "react";

export type DiaryStat = {
  label: string;
  value: string | number;
  hint?: string;
};

/** Карточка метрик — как у Huckleberry / референс схваток */
export function DiaryStats({ items }: { items: DiaryStat[] }) {
  const n = Math.min(4, Math.max(1, items.length));
  return (
    <div className="rounded-2xl border border-line bg-card px-2 py-3.5 shadow-sm sm:px-3">
      <div
        className="grid gap-1 text-center"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {items.slice(0, n).map((it, i) => (
          <div
            key={it.label}
            className={i > 0 ? "border-l border-line px-1" : "px-1"}
          >
            <p className="text-[10px] leading-tight text-muted">{it.label}</p>
            <p className="mt-1.5 font-display text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
              {it.value}
            </p>
            {it.hint ? (
              <p className="mt-0.5 text-[10px] text-muted">{it.hint}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiarySectionTitle({
  left,
  right,
}: {
  left: string;
  right?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between px-0.5 text-[11px] font-medium text-muted">
      <span>{left}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

/** Строка таймлайна с кружком по центру */
export function DiaryTimelineRow({
  left,
  right,
  mark,
  accent,
  onClick,
}: {
  left: ReactNode;
  right?: ReactNode;
  mark: ReactNode;
  accent?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="relative grid w-full grid-cols-[1fr_2.5rem_1fr] items-center gap-2 py-2.5 text-left"
    >
      <div className="pr-1 text-right">{left}</div>
      <div className="relative z-[1] flex justify-center">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-[var(--on-accent,#fff)] shadow-sm ${
            accent
              ? "bg-gradient-to-br from-accent to-[color-mix(in_oklab,var(--accent)_65%,#fb7185)] ring-4 ring-accent/15"
              : "bg-gradient-to-br from-accent/90 to-[color-mix(in_oklab,var(--accent)_70%,#fb7185)]"
          }`}
        >
          {mark}
        </span>
      </div>
      <div className="pl-1">{right}</div>
    </Tag>
  );
}

export function DiaryTimeline({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute bottom-3 left-1/2 top-3 w-px -translate-x-1/2 bg-accent/25"
        aria-hidden
      />
      <ul>{children}</ul>
    </div>
  );
}

export function DiaryStickyCta({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2">
        {children}
      </div>
    </div>
  );
}

export function DiaryPrimaryButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-4 text-base font-semibold text-[var(--on-accent,#fff)] shadow-[0_8px_28px_color-mix(in_oklab,var(--accent)_40%,transparent)] transition active:scale-[0.98] disabled:opacity-40 ${
        danger
          ? "bg-gradient-to-r from-[color-mix(in_oklab,var(--accent)_80%,#ef4444)] to-accent"
          : "bg-gradient-to-r from-accent via-[color-mix(in_oklab,var(--accent)_85%,#fb7185)] to-[color-mix(in_oklab,var(--accent)_75%,#f97316)]"
      }`}
    >
      {children}
    </button>
  );
}

export function DiaryChip({
  active,
  onClick,
  children,
  tone = "default",
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "default" | "warn" | "hot";
}) {
  const activeCls =
    tone === "hot"
      ? "bg-blush-soft text-blush ring-1 ring-blush/35"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/30 dark:text-amber-200"
        : "bg-accent text-[var(--on-accent,#fff)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? activeCls
          : "border border-line text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function DiaryEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="mt-8 text-center text-sm text-muted">{children}</p>
  );
}

export function DiaryPage({
  children,
  stickyPad,
}: {
  children: ReactNode;
  stickyPad?: boolean;
}) {
  return (
    <div className={`relative ${stickyPad ? "pb-28" : ""}`}>{children}</div>
  );
}
