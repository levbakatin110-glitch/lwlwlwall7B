"use client";

import Link from "next/link";
import { useMemo } from "react";
import { findOnThisDay } from "@/lib/on-this-day";
import { useAppStore } from "@/lib/store";

export function OnThisDayCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  const memories = useAppStore((s) => s.memories);
  const hit = useMemo(() => findOnThisDay(memories), [memories]);

  if (!hit) return null;

  const { memory, label } = hit;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-line bg-card shadow-sm ${
        compact ? "" : "maya-panel"
      }`}
    >
      <div className={`flex gap-3 ${compact ? "p-3" : "p-4"}`}>
        {memory.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={memory.photoUrl}
            alt=""
            className={`shrink-0 rounded-xl object-cover ring-1 ring-line/70 ${
              compact ? "h-20 w-16" : "h-28 w-[5.5rem] sm:h-32 sm:w-24"
            }`}
          />
        ) : (
          <div
            className={`flex shrink-0 items-center justify-center rounded-xl bg-accent-soft text-center text-[10px] text-muted ${
              compact ? "h-20 w-16" : "h-28 w-[5.5rem]"
            }`}
          >
            без фото
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            {label}
          </p>
          <p className="font-display mt-1 text-base font-semibold leading-snug text-foreground sm:text-lg">
            В этот день
          </p>
          {memory.text ? (
            <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-foreground/90">
              {memory.text}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted">Сохранённый кадр · {memory.date}</p>
          )}
          {!compact && (
            <Link
              href="/memories"
              className="mt-2 inline-block text-xs font-medium text-accent underline-offset-2 hover:underline"
            >
              Все моменты
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
