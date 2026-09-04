"use client";

import type { ReactNode } from "react";

export type DiaryStat = {
  label: string;
  value: string | number;
  hint?: string;
};

/** Сводка: ровные колонки, без дыры между первой цифрой и остальными. */
export function DiaryStats({ items }: { items: DiaryStat[] }) {
  if (!items.length) return null;
  const cols =
    items.length <= 1
      ? "grid-cols-1"
      : items.length === 2
        ? "grid-cols-2"
        : items.length === 4
          ? "grid-cols-2 sm:grid-cols-4"
          : "grid-cols-3";
  return (
    <div className={`maya-diary-hero grid ${cols} gap-2`}>
      {items.map((it) => (
        <div
          key={it.label}
          className="min-w-0 rounded-2xl border border-line bg-card/70 px-2 py-2.5 text-center"
        >
          <p className="text-[10px] font-medium tracking-wide text-muted">
            {it.label}
          </p>
          <p className="font-display mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
            {it.value}
          </p>
          {it.hint ? (
            <p className="mt-0.5 text-[10px] text-muted">{it.hint}</p>
          ) : null}
        </div>
      ))}
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
    <div className="mb-1.5 flex items-center justify-between px-0.5">
      <span className="text-[11px] font-semibold tracking-wide text-muted">
        {left}
      </span>
      {right ? (
        <span className="text-[11px] tabular-nums text-muted/80">{right}</span>
      ) : null}
    </div>
  );
}

export function DiaryTimelineRow({
  left,
  right,
  mark,
  accent,
  tone = "default",
  onClick,
}: {
  left: ReactNode;
  right?: ReactNode;
  mark?: ReactNode;
  accent?: boolean;
  tone?: "default" | "warn" | "hot";
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  const markTone =
    tone === "hot"
      ? "bg-blush-soft text-blush"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
        : accent
          ? "bg-accent-soft text-accent"
          : "bg-foreground/[0.06] text-foreground/80";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`maya-diary-row flex w-full items-center gap-3 px-3 py-3 text-left ${
        onClick ? "active:bg-accent-soft/40" : ""
      }`}
    >
      {mark != null ? (
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${markTone}`}
        >
          {mark}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">{left}</div>
      {right != null ? (
        <div className="max-w-[42%] shrink-0 text-right font-display text-[15px] font-semibold tabular-nums leading-snug">
          {right}
        </div>
      ) : null}
    </Tag>
  );
}

export function DiaryTimeline({ children }: { children: ReactNode }) {
  return <ul className="maya-diary-list">{children}</ul>;
}

export function DiaryStickyCta({ children }: { children: ReactNode }) {
  return (
    <div className="order-first">
      <div className="flex w-full flex-col gap-2">{children}</div>
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
      className={`flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-[1.05rem] text-[15px] font-semibold text-[var(--on-accent,#fff)] transition active:scale-[0.98] disabled:opacity-35 ${
        danger ? "maya-diary-cta-danger" : "maya-diary-cta"
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
      ? "bg-blush-soft text-blush ring-1 ring-blush/30"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/25 dark:text-amber-200"
        : "bg-accent text-[var(--on-accent,#fff)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
        active
          ? activeCls
          : "bg-foreground/[0.04] text-muted hover:bg-foreground/[0.07] hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function DiaryEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 py-8 text-center text-sm leading-relaxed text-muted">
      {children}
    </p>
  );
}

export function DiaryPanel({ children }: { children: ReactNode }) {
  return <div className="maya-diary-panel">{children}</div>;
}

/** Полоска последнего часа: занятые минуты подсвечены. */
export function DiaryHourStrip({
  now,
  spans,
}: {
  now: number;
  spans: { startMs: number; endMs: number }[];
}) {
  const windowMs = 60 * 60 * 1000;
  const from = now - windowMs;
  const cells = 36;
  const cellMs = windowMs / cells;
  return (
    <div>
      <div className="maya-diary-strip flex h-2 overflow-hidden">
        {Array.from({ length: cells }, (_, i) => {
          const a = from + i * cellMs;
          const b = a + cellMs;
          const hit = spans.some((s) => s.startMs < b && s.endMs > a);
          return (
            <span
              key={i}
              className={`h-full flex-1 ${hit ? "bg-accent" : ""}`}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted">
        <span>час назад</span>
        <span>сейчас</span>
      </div>
    </div>
  );
}

/** 24 часа: когда спали. */
export function DiaryDayStrip({
  now,
  spans,
}: {
  now: number;
  spans: { startMs: number; endMs: number }[];
}) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const from = start.getTime();
  const windowMs = 24 * 60 * 60 * 1000;
  const cells = 48;
  const cellMs = windowMs / cells;
  return (
    <div>
      <div className="maya-diary-strip flex h-2 overflow-hidden">
        {Array.from({ length: cells }, (_, i) => {
          const a = from + i * cellMs;
          const b = a + cellMs;
          const hit = spans.some((s) => s.startMs < b && s.endMs > a);
          return (
            <span
              key={i}
              className={`h-full flex-1 ${hit ? "bg-accent/90" : ""}`}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted">
        <span>00</span>
        <span>12</span>
        <span>24</span>
      </div>
    </div>
  );
}

export function DiaryPage({
  children,
  stickyPad: _stickyPad,
}: {
  children: ReactNode;
  /** @deprecated CTA больше не fixed — отступ не нужен */
  stickyPad?: boolean;
}) {
  return (
    <div className="relative flex flex-col gap-3.5">{children}</div>
  );
}
