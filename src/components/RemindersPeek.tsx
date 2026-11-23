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
      className="group relative flex min-h-[11.5rem] flex-col overflow-hidden rounded-2xl border border-line bg-card p-4 shadow-sm transition hover:border-accent/35 hover:shadow-md"
    >
      <div className="relative flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent">
          <MayaIcon name="bell" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold leading-snug text-foreground">
            {on.length > 0
              ? `Включено: ${on.length}`
              : "Пока всё выключено"}
          </p>
        </div>
      </div>
      <ul className="relative mt-3 flex-1 space-y-1.5">
        {on.length === 0 ? (
          <li className="text-sm leading-relaxed text-muted">
            Кормление, укладывание, прогулка — откройте, чтобы включить.
          </li>
        ) : (
          on.slice(0, 4).map((p) => (
            <li key={p.kind} className="flex items-center gap-2 text-sm text-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {p.label}
            </li>
          ))
        )}
      </ul>
      <p className="relative mt-2 text-sm font-semibold text-accent group-hover:underline">
        Настроить →
      </p>
    </Link>
  );
}
