"use client";

import { useEffect } from "react";
import { getVisitorId } from "@/lib/analytics-client";

const INTERVAL_MS = 25_000;

function ping(path: string) {
  if (typeof document !== "undefined" && document.hidden) return;
  if (path.startsWith("/admin") || path.startsWith("/legal")) return;
  try {
    const body = JSON.stringify({
      visitorId: getVisitorId(),
      path,
    });
    void fetch("/api/analytics/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

/** Тихий пинг «я на сайте», чтобы в CRM было видно живых. */
export function PresenceHeartbeat({ path }: { path: string }) {
  useEffect(() => {
    ping(path);
    const id = window.setInterval(() => ping(path), INTERVAL_MS);
    const onVis = () => {
      if (!document.hidden) ping(path);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [path]);

  return null;
}
