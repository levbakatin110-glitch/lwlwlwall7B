"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/** Применяет тему к <html> и meta theme-color */
export function ThemeSync() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
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
