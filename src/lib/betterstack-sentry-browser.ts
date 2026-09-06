"use client";

import { betterStackDsn, betterStackEnabled } from "@/lib/betterstack-sentry";
import {
  isStaleChunkError,
  isStaleChunkSentryEvent,
} from "@/lib/stale-chunk-error";

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
    ignoreErrors: [
      /ChunkLoadError/i,
      /Loading chunk \d+ failed/i,
      /Failed to fetch dynamically imported module/i,
    ],
    beforeSend(event, hint) {
      if (isStaleChunkError(hint.originalException)) return null;
      const values = event.exception?.values ?? [];
      const message = values.map((v) => `${v.type ?? ""} ${v.value ?? ""}`).join(" ");
      const culprit = String(
        (event as { culprit?: string }).culprit ?? event.transaction ?? "",
      );
      if (isStaleChunkSentryEvent(message, culprit)) return null;
      return event;
    },
  });
}

export function captureBetterStackException(error: unknown): void {
  if (!betterStackEnabled() || isStaleChunkError(error)) return;
  void initBetterStackBrowser().then(() => {
    sentryMod?.captureException(error);
  });
}
