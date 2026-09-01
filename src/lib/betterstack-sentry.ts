/** Better Stack — только браузер. @sentry/node сюда не импортировать (webpack). */

export function betterStackDsn(): string | undefined {
  const dsn =
    process.env.NEXT_PUBLIC_BETTERSTACK_DSN?.trim() ||
    process.env.BETTERSTACK_DSN?.trim() ||
    process.env.SENTRY_DSN?.trim();
  return dsn || undefined;
}

export function betterStackEnabled(): boolean {
  return Boolean(betterStackDsn()) && process.env.NODE_ENV === "production";
}

let browserReady = false;

export function initBetterStackBrowser(): void {
  if (typeof window === "undefined" || browserReady || !betterStackEnabled()) {
    return;
  }
  browserReady = true;
  void import("@sentry/browser")
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

export function captureBetterStackException(error: unknown): void {
  if (typeof window === "undefined" || !betterStackEnabled()) return;
  void import("@sentry/browser")
    .then((Sentry) => Sentry.captureException(error))
    .catch(() => {
      /* ignore telemetry failures */
    });
}
