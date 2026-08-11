"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics-client";

/** Один визит в сутки на браузер */
export function AnalyticsVisitBeacon() {
  useEffect(() => {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const key = `maya-visit-${day}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      trackEvent("visit");
    } catch {
      trackEvent("visit");
    }
  }, []);

  return null;
}
