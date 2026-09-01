export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initBetterStackServer } = await import("./lib/betterstack-sentry");
    initBetterStackServer();
  }
}
