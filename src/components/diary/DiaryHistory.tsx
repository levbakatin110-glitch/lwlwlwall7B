"use client";

import { Fragment, type ReactNode } from "react";
import { MayaIcon, type IconName } from "@/components/icons/MayaIcon";
import {
  dateCaptionRu,
  formatGap,
  groupEntriesByDay,
  entryTimeMs,
} from "@/lib/diary-day";
import type { JournalEntry } from "@/lib/types";

export function DiaryDayHeading({
  label,
  date,
}: {
  label: string;
  date: string;
}) {
  const showDate = date && date !== label;
  return (
    <div className="mb-2.5 text-center">
      <p className="font-display text-base font-semibold tracking-tight text-foreground">
        {label}
      </p>
      {showDate ? (
        <p className="mt-0.5 text-[11px] capitalize text-muted">{date}</p>
      ) : null}
    </div>
  );
}

export function DiaryGap({ label }: { label: string }) {
  return (
    <div className="relative flex items-center justify-center py-2.5">
      <span
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed border-line"
        aria-hidden
      />
      <span className="relative rounded-full border border-line bg-background px-3 py-0.5 text-[11px] font-semibold tabular-nums text-muted">
        {label}
      </span>
    </div>
  );
}

export const DIARY_ICON_TONE = {
  sleep:
    "bg-[color-mix(in_oklab,var(--accent)_22%,transparent)] text-accent",
  feeding: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  formula: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  solids: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  diaper: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  water: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  walk: "bg-[color-mix(in_oklab,var(--accent)_22%,transparent)] text-accent",
} as const;

export function DiaryEventCard({
  icon,
  title,
  meta,
  accent,
  onClick,
  tone,
}: {
  icon: IconName;
  title: string;
  meta: string;
  accent?: boolean;
  onClick?: () => void;
  tone?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`mb-2.5 flex w-full items-center gap-3 rounded-full border border-line bg-card/90 px-3.5 py-3 text-left shadow-[0_1px_0_rgba(0,0,0,0.04)] ${
        accent ? "ring-1 ring-accent/30" : ""
      } ${onClick ? "active:bg-accent-soft/40" : ""}`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          tone ??
          (accent ? "bg-accent-soft text-accent" : "bg-accent-soft/80 text-accent")
        }`}
      >
        <MayaIcon name={icon} size={20} />
      </span>
      <div className="min-w-0 flex-1 pr-1">
        <p className="font-display text-[15px] font-semibold text-foreground">
          {title}
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">{meta}</p>
      </div>
    </Tag>
  );
}

export function DiaryEntryJournal({
  entries,
  icon,
  titleOf,
  metaOf,
  getTimeMs = entryTimeMs,
  gapBetween,
  onRemove,
  confirmText = "Удалить эту запись из дневника?",
  empty,
  iconTone,
}: {
  entries: JournalEntry[];
  icon: IconName;
  titleOf: (e: JournalEntry) => string;
  metaOf: (e: JournalEntry) => string;
  getTimeMs?: (e: JournalEntry) => number;
  gapBetween?: (newer: JournalEntry, older: JournalEntry) => number;
  onRemove?: (id: string) => void;
  confirmText?: string;
  empty?: ReactNode;
  iconTone?: string;
}) {
  const days = groupEntriesByDay(entries, getTimeMs);
  if (!days.length) return empty ? <>{empty}</> : null;

  return (
    <div>
      {days.map((day) => (
        <section key={day.ymd} className="mt-6 first:mt-1">
          <DiaryDayHeading label={day.label} date={day.dateCaption} />
          {day.entries.map((e, i) => {
            const older = day.entries[i + 1];
            const gapMs = older
              ? gapBetween
                ? gapBetween(e, older)
                : getTimeMs(e) - getTimeMs(older)
              : 0;
            return (
              <Fragment key={e.id}>
                <DiaryEventCard
                  icon={icon}
                  tone={iconTone}
                  title={titleOf(e)}
                  meta={metaOf(e)}
                  accent={i === 0 && day.label === "Сегодня"}
                  onClick={
                    onRemove
                      ? () => {
                          if (window.confirm(confirmText)) onRemove(e.id);
                        }
                      : undefined
                  }
                />
                {older && gapMs >= 60_000 ? (
                  <DiaryGap label={formatGap(0, gapMs)} />
                ) : older ? (
                  <div className="h-1" />
                ) : null}
              </Fragment>
            );
          })}
        </section>
      ))}
    </div>
  );
}

export function dayCaption(ymd: string): string {
  return dateCaptionRu(ymd);
}
