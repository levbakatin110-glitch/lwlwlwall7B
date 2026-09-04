"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { CARE_PRESETS } from "@/lib/care-reminders";
import { getCareReminders, useAppStore } from "@/lib/store";

export function RemindersPeek() {
  const childSpaces = useAppStore((s) => s.childSpaces);
  const activeChildId = useAppStore((s) => s.activeChildId);
  const saved = useMemo(
    () => getCareReminders({ childSpaces, activeChildId }),
    [childSpaces, activeChildId],
  );
  const on = CARE_PRESETS.filter((p) =>
    saved.some((r) => r.kind === p.kind && r.enabled),
  );

  return (
    <Link
      href="/reminders"
      className="group relative flex min-h-[11.5rem] flex-col overflow-hidden rounded-2xl border border-amber-600/20 bg-white/70 p-4 shadow-sm transition hover:border-amber-600/40 dark:bg-card/80"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-400/20 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-600 text-white">
          <MayaIcon name="bell" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300">
            Режим дня
          </p>
          <p className="font-display mt-0.5 text-lg font-semibold leading-snug text-foreground">
            {on.length > 0
              ? `Включено: ${on.length}`
              : "Пока всё выключено"}
          </p>
        </div>
      </div>
      <ul className="relative mt-3 flex-1 space-y-1.5">
        {on.length === 0 ? (
          <li className="text-sm leading-relaxed text-muted">
            Кормление, укладывание, прогулка — нажмите, чтобы включить.
          </li>
        ) : (
          on.slice(0, 4).map((p) => (
            <li key={p.kind} className="flex items-center gap-2 text-sm text-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
              {p.label}
            </li>
          ))
        )}
      </ul>
      <p className="relative mt-2 text-sm font-semibold text-amber-800 group-hover:underline dark:text-amber-300">
        Настроить →
      </p>
    </Link>
  );
}
