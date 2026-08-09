"use client";

import { useEffect } from "react";

/** Сбрасывает старый SW-кэш, чтобы подтянуть новую Маю */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* ignore */
      }
      // лёгкий SW только для «Установить», без кэша JS
      void navigator.serviceWorker.register("/sw.js?v=5").catch(() => {});
    })();
  }, []);

  return null;
}
