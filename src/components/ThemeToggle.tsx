"use client";

import { useAppStore } from "@/lib/store";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const isBlush = theme === "blush";

  return (
    <button
      type="button"
      onClick={() => setTheme(isBlush ? "dark" : "blush")}
      aria-label={isBlush ? "Тёмная тема" : "Розовая тема"}
      title={isBlush ? "Тёмная тема" : "Розовая тема"}
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-card font-semibold text-foreground shadow-sm transition hover:border-accent/40 hover:bg-accent-soft ${
        compact ? "h-8 px-2.5 text-[11px]" : "h-10 px-3.5 text-xs"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isBlush
            ? "bg-gradient-to-br from-accent to-blush"
            : "bg-foreground/80"
        }`}
        aria-hidden
      />
      Тема
    </button>
  );
}
