"use client";

import type { ReactNode } from "react";

export type DiaryStat = {
  label: string;
  value: string | number;
  hint?: string;
};

/** Карточка метрик */
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

/** Строка записи — карточка, без «плывущей» сетки таймлайна */
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
      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left shadow-sm transition ${
        accent
          ? "border-accent/35 bg-accent-soft/50"
          : "border-line bg-card"
      } ${onClick ? "active:scale-[0.99]" : ""}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[var(--on-accent,#fff)] shadow-sm ${
          accent
            ? "bg-gradient-to-br from-accent to-[color-mix(in_oklab,var(--accent)_65%,#fb7185)] ring-4 ring-accent/15"
            : "bg-gradient-to-br from-accent/90 to-[color-mix(in_oklab,var(--accent)_70%,#fb7185)]"
        }`}
      >
        {mark}
      </span>
      <div className="min-w-0 flex-1 text-left [&>div]:items-start [&>div]:text-left [&_.items-end]:!items-start [&_.text-right]:!text-left">
        {left}
      </div>
      {right != null ? (
        <div className="max-w-[40%] shrink-0 text-right text-sm">{right}</div>
      ) : null}
    </Tag>
  );
}

export function DiaryTimeline({ children }: { children: ReactNode }) {
  return <ul className="space-y-2">{children}</ul>;
}

/**
 * CTA в потоке (order-first), не position:fixed.
 * У .maya-page animation с transform ломает fixed — кнопка уезжала поверх списка.
 */
export function DiaryStickyCta({ children }: { children: ReactNode }) {
  return (
    <div className="order-first rounded-2xl border border-line bg-card p-3 shadow-sm">
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
    <p className="mt-6 text-center text-sm text-muted">{children}</p>
  );
}

export function DiaryCoach({
  tone,
  title,
  children,
}: {
  tone: "ok" | "watch" | "go" | "tip";
  title: string;
  children: ReactNode;
}) {
  const wrap =
    tone === "go"
      ? "border-blush/45 bg-blush-soft"
      : tone === "watch"
        ? "border-amber-400/40 bg-amber-400/10"
        : tone === "ok"
          ? "border-emerald-500/30 bg-emerald-500/8"
          : "border-accent/25 bg-accent-soft/50";
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${wrap}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        Мая подсказывает
      </p>
      <p className="mt-1 font-display text-lg font-semibold leading-tight tracking-tight">
        {title}
      </p>
      <div className="mt-1.5 text-sm leading-relaxed text-foreground/85">
        {children}
      </div>
    </div>
  );
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
  const cells = 30;
  const cellMs = windowMs / cells;
  return (
    <div>
      <div className="flex h-8 overflow-hidden rounded-xl border border-line bg-background">
        {Array.from({ length: cells }, (_, i) => {
          const a = from + i * cellMs;
          const b = a + cellMs;
          const hit = spans.some((s) => s.startMs < b && s.endMs > a);
          return (
            <span
              key={i}
              className={`h-full flex-1 ${
                hit ? "bg-accent" : "bg-transparent"
              } ${i > 0 ? "border-l border-line/40" : ""}`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>час назад</span>
        <span>сейчас</span>
      </div>
    </div>
  );
}

/** 24 часа: когда спали (для сна малыша / мамы). */
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
      <div className="flex h-7 overflow-hidden rounded-xl border border-line bg-background">
        {Array.from({ length: cells }, (_, i) => {
          const a = from + i * cellMs;
          const b = a + cellMs;
          const hit = spans.some((s) => s.startMs < b && s.endMs > a);
          return (
            <span
              key={i}
              className={`h-full flex-1 ${hit ? "bg-accent/85" : ""} ${
                i > 0 ? "border-l border-line/30" : ""
              }`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>00:00</span>
        <span>12:00</span>
        <span>24:00</span>
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
    <div className="relative flex flex-col gap-4">{children}</div>
  );
}
