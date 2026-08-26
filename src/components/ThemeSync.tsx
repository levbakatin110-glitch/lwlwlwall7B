"use client";

import { useEffect } from "react";
import { THEME_KEY } from "@/lib/durable-storage";
import { useAppStore } from "@/lib/store";

/** Применяет тему к <html> и meta theme-color */
export function ThemeSync() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        "content",
        theme === "blush" ? "#fff6f8" : "#000000",
      );
    }
  }, [theme]);

  return null;
}
