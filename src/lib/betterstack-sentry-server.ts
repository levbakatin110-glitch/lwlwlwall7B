import { betterStackDsn, betterStackEnabled } from "@/lib/betterstack-sentry";

let serverReady = false;

/** Только Node runtime (instrumentation.ts). Не импортировать из "use client". */
export function initBetterStackServer(): void {
  if (
    serverReady ||
    process.env.NEXT_RUNTIME !== "nodejs" ||
    !betterStackEnabled()
  ) {
    return;
  }
  serverReady = true;
  void import("@sentry/node")
    .then((Sentry) => {
      Sentry.init({
        dsn: betterStackDsn(),
        environment: "production",
        tracesSampleRate: 0.05,
      });
    })
    .catch(() => {
      /* ignore */
    });
}
