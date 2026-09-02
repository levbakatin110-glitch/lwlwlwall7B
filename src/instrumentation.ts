import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initBetterStackServer } = await import(
      "./lib/betterstack-sentry-server"
    );
    await initBetterStackServer();
    if (!process.env.NEXT_PHASE) {
      const { startPushTickLoop } = await import("./lib/push-tick");
      startPushTickLoop();
    }
  }
}

/** Любая серверная ошибка (API 500, SSR) → Better Stack */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureBetterStackServerException } = await import(
    "./lib/betterstack-sentry-server"
  );
  const path =
    typeof request === "object" && request !== null && "path" in request
      ? String(request.path)
      : "";
  const wrapped =
    err instanceof Error
      ? err
      : new Error(typeof err === "string" ? err : "Server request error");
  if (path && !wrapped.message.includes(path)) {
    wrapped.message = `${wrapped.message} · ${path}`;
  }
  await captureBetterStackServerException(wrapped);
};
