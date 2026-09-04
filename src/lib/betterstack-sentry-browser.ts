"use client";

import { betterStackDsn, betterStackEnabled } from "@/lib/betterstack-sentry";

let ready = false;
let sentryMod: typeof import("@sentry/browser") | null = null;

async function loadSentry() {
  if (sentryMod) return sentryMod;
  sentryMod = await import("@sentry/browser");
  return sentryMod;
}

/** Подключает Sentry лениво — не в первом бандле телефона. */
export async function initBetterStackBrowser(): Promise<void> {
  if (ready || typeof window === "undefined" || !betterStackEnabled()) return;
  const dsn = betterStackDsn();
  if (!dsn) return;
  const Sentry = await loadSentry();
  if (ready) return;
  ready = true;
  Sentry.init({
    dsn,
    environment: "production",
    tracesSampleRate: 0.05,
  });
}

export function captureBetterStackException(error: unknown): void {
  if (!betterStackEnabled()) return;
  void initBetterStackBrowser().then(() => {
    sentryMod?.captureException(error);
  });
}
