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
