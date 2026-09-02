/** Better Stack — DSN и флаги (без @sentry/* — безопасно для server imports). */

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
