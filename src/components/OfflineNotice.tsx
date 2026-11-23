"use client";

import type { ReactNode } from "react";
import { OFFLINE_MESSAGE, useOnline } from "@/lib/use-online";

type Props = {
  /** banner — полоска сверху; block — на весь экран */
  variant?: "banner" | "block";
  className?: string;
};

export function OfflineNotice({ variant = "banner", className = "" }: Props) {
  if (variant === "block") {
    return (
      <div
        className={`flex h-full min-h-[12rem] flex-1 flex-col items-center justify-center px-4 text-center ${className}`}
        role="status"
        aria-live="polite"
      >
        <p className="max-w-sm text-sm font-medium text-foreground">
          {OFFLINE_MESSAGE}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 rounded-xl border border-line bg-card/95 px-3 py-2 text-center text-sm text-foreground ${className}`}
      role="status"
      aria-live="polite"
    >
      {OFFLINE_MESSAGE}
    </div>
  );
}

/** Показывает children только онлайн, иначе block-заглушку. */
export function OfflineGate({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const online = useOnline();
  if (!online) {
    return <OfflineNotice variant="block" className={className} />;
  }
  return <>{children}</>;
}
