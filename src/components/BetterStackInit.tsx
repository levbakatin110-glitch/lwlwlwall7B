"use client";

import { useEffect } from "react";
import { initBetterStackBrowser } from "@/lib/betterstack-sentry-browser";

/** Инициализация Better Stack (Sentry SDK) в браузере пользователя. */
export function BetterStackInit() {
  useEffect(() => {
    initBetterStackBrowser();
  }, []);
  return null;
}
