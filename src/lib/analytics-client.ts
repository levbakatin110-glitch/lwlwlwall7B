"use client";

/** Лёгкий трекер воронки → /api/analytics/track */

const VID_KEY = "maya-vid";

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(VID_KEY);
    if (!id) {
      id = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(VID_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function trackEvent(
  name:
    | "visit"
    | "register"
    | "login"
    | "onboarding_done"
    | "chat_send"
    | "pricing_view"
    | "subscribe_click"
    | "subscribe_activate",
  meta?: string,
) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      name,
      visitorId: getVisitorId(),
      meta,
    });
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/track", blob);
      return;
    }
    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // ignore
  }
}
