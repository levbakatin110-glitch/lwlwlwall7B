"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

const DISMISS_KEY = "maya-sync-hint-dismissed";

/** На компьютере без входа записи живут только в этом браузере и легко пропадают. */
export function DesktopSyncHint() {
  const accountEmail = useAppStore((s) => s.accountEmail);
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (accountEmail || !onboardingDone) {
      setHidden(true);
      return;
    }
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") {
        setHidden(true);
        return;
      }
    } catch {
      /* ignore */
    }
    setHidden(false);
  }, [accountEmail, onboardingDone]);

  if (hidden) return null;

  return (
    <div className="shrink-0 border-b border-line bg-accent-soft px-3 py-2 text-sm text-foreground">
      <div className="mx-auto flex max-w-3xl items-start gap-2">
        <p className="min-w-0 flex-1 leading-snug">
          На компьютере войдите с той же почтой, что на телефоне — иначе записи
          не переносятся и после обновления страницы могут пропасть.{" "}
          <Link href="/profile" className="font-semibold underline underline-offset-2">
            Войти
          </Link>
        </p>
        <button
          type="button"
          aria-label="Скрыть"
          className="shrink-0 rounded-lg px-2 py-0.5 text-muted hover:text-foreground"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
            setHidden(true);
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
