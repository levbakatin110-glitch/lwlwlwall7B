"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { childDisplayName } from "@/lib/children";
import { useAppStore } from "@/lib/store";

function formatToday() {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
  } catch {
    return new Date().toLocaleDateString("ru-RU");
  }
}

/** Шапка меню: имя и дата открывают профиль */
export function SidebarHeader({
  trailing,
  onNavigate,
}: {
  trailing?: ReactNode;
  onNavigate?: () => void;
}) {
  const profile = useAppStore((s) => s.profile);
  const today = useMemo(() => formatToday(), []);
  const name = childDisplayName(profile);
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/profile"
        onClick={onNavigate}
        aria-label="Профиль"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none transition active:opacity-80 focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-accent-soft ring-1 ring-line">
          {profile.photoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoData}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="m-auto font-display text-base font-semibold text-accent">
              {initial}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-lg font-semibold leading-none tracking-tight text-foreground">
            {name}
          </p>
          <p className="mt-1 truncate text-[11px] capitalize leading-none text-muted">
            {today}
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle compact />
        {trailing}
      </div>
    </div>
  );
}
