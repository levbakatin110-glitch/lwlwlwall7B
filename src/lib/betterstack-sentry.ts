/** Better Stack принимает Sentry SDK — DSN из вкладки Ingest приложения. */

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
let serverReady = false;

export function initBetterStackBrowser(): void {
  if (typeof window === "undefined" || browserReady || !betterStackEnabled()) return;
  browserReady = true;
  void import("@sentry/browser").then((Sentry) => {
    Sentry.init({
      dsn: betterStackDsn(),
      environment: "production",
      tracesSampleRate: 0.05,
    });
  });
}

export function initBetterStackServer(): void {
  if (serverReady || process.env.NEXT_RUNTIME !== "nodejs" || !betterStackEnabled()) {
    return;
  }
  serverReady = true;
  void import("@sentry/node").then((Sentry) => {
    Sentry.init({
      dsn: betterStackDsn(),
      environment: "production",
      tracesSampleRate: 0.05,
    });
  });
}

export function captureBetterStackException(error: unknown): void {
  if (!betterStackEnabled()) return;
  const run =
    typeof window === "undefined"
      ? import("@sentry/node").then((Sentry) => Sentry.captureException(error))
      : import("@sentry/browser").then((Sentry) => Sentry.captureException(error));
  void run.catch(() => {
    /* ignore telemetry failures */
  });
}
