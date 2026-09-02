"use client";

import * as Sentry from "@sentry/browser";
import { betterStackDsn, betterStackEnabled } from "@/lib/betterstack-sentry";

let ready = false;

function ensureInit(): void {
  if (ready || typeof window === "undefined" || !betterStackEnabled()) return;
  const dsn = betterStackDsn();
  if (!dsn) return;
  ready = true;
  Sentry.init({
    dsn,
    environment: "production",
    tracesSampleRate: 0.05,
  });

  // Один ping за сессию — чтобы в Network был POST (фильтр: 2726260)
  try {
    if (!sessionStorage.getItem("maya-betterstack-ping")) {
      sessionStorage.setItem("maya-betterstack-ping", "1");
      Sentry.captureMessage("hey-maya · клиент", "info");
      void Sentry.flush(5000);
    }
  } catch {
    /* private mode / sessionStorage blocked */
  }
}

// Сразу при загрузке страницы — не ждём useEffect
ensureInit();

export function initBetterStackBrowser(): void {
  ensureInit();
}

export function captureBetterStackException(error: unknown): void {
  if (!betterStackEnabled()) return;
  ensureInit();
  if (!ready) return;
  Sentry.captureException(error);
}
