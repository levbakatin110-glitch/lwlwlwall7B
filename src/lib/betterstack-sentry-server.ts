import { betterStackDsn, betterStackEnabled } from "@/lib/betterstack-sentry";

let initPromise: Promise<void> | null = null;

/** Только Node runtime (instrumentation.ts). Не импортировать из "use client". */
export function initBetterStackServer(): Promise<void> {
  if (
    initPromise ||
    process.env.NEXT_RUNTIME !== "nodejs" ||
    !betterStackEnabled()
  ) {
    return initPromise ?? Promise.resolve();
  }

  initPromise = import("@sentry/node")
    .then((Sentry) => {
      Sentry.init({
        dsn: betterStackDsn(),
        environment: "production",
        tracesSampleRate: 0.05,
      });
      Sentry.captureMessage("hey-maya · сервер запущен", "info");
    })
    .catch(() => {
      /* telemetry optional */
    });

  return initPromise;
}

export async function captureBetterStackServerException(
  error: unknown,
): Promise<void> {
  if (!betterStackEnabled()) return;
  await initBetterStackServer();
  try {
    const Sentry = await import("@sentry/node");
    Sentry.captureException(error);
  } catch {
    /* ignore */
  }
}
