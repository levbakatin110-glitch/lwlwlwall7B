"use client";

import { useEffect } from "react";

/** Регистрирует SW после первого кадра, чтобы не отбирать сеть у UI. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    try {
      sessionStorage.removeItem("maya-chunk-reload");
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => {
      void navigator.serviceWorker.register("/sw.js?v=15").catch(() => {});
    }, 3500);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
