"use client";

import { useEffect } from "react";
import { initBetterStackBrowser } from "@/lib/betterstack-sentry-browser";

/** Sentry после первого кадра — не тормозит открытие на телефоне. */
export function BetterStackInit() {
  useEffect(() => {
    const t = window.setTimeout(() => initBetterStackBrowser(), 2000);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
