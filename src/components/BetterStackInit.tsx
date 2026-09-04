"use client";

import { useEffect } from "react";

/** Sentry после первого кадра — не тормозит открытие на телефоне. */
export function BetterStackInit() {
  useEffect(() => {
    const t = window.setTimeout(() => {
      void import("@/lib/betterstack-sentry-browser").then((m) =>
        m.initBetterStackBrowser(),
      );
    }, 4000);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
