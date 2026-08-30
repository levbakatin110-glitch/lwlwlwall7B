"use client";

import { useEffect } from "react";

/** Регистрирует SW для установки PWA и push. Не сносит подписку при каждом заходе. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    try {
      sessionStorage.removeItem("maya-chunk-reload");
    } catch {
      /* ignore */
    }
    void navigator.serviceWorker.register("/sw.js?v=11").catch(() => {});
  }, []);

  return null;
}
