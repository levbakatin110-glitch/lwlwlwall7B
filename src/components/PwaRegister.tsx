"use client";

import { useEffect } from "react";

/** Регистрирует SW сразу — иначе таймер не успевает показать увед на блокировке. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    try {
      sessionStorage.removeItem("maya-chunk-reload");
    } catch {
      /* ignore */
    }
    void navigator.serviceWorker.register("/sw.js?v=16").catch(() => {});
  }, []);

  return null;
}
