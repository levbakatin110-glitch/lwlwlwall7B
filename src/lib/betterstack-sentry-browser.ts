"use client";

import * as Sentry from "@sentry/browser";
import { betterStackDsn, betterStackEnabled } from "@/lib/betterstack-sentry";

let ready = false;

export function initBetterStackBrowser(): void {
  if (ready || !betterStackEnabled()) return;
  const dsn = betterStackDsn();
  if (!dsn) return;
  ready = true;
  Sentry.init({
    dsn,
    environment: "production",
    tracesSampleRate: 0.05,
  });
}

export function captureBetterStackException(error: unknown): void {
  if (!betterStackEnabled()) return;
  if (!ready) initBetterStackBrowser();
  Sentry.captureException(error);
}
