"use client";

import { useEffect } from "react";

/**
 * Ловит падение root layout / AppShell.
 * Без этого Next показывает английский «This page couldn't load».
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[maya] global error", error);
    try {
      sessionStorage.setItem("maya-crash", "1");
    } catch {
      /* ignore */
    }
    try {
      if (sessionStorage.getItem("maya-auto-repaired") !== "1") {
        sessionStorage.setItem("maya-auto-repaired", "1");
        void wipeAndReload();
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on crash
  }, [error]);

  async function wipeAndReload() {
    try {
      sessionStorage.setItem("maya-crash", "1");
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem("maya-mom-ai");
      localStorage.removeItem("maya-theme");
      localStorage.removeItem("maya-identity-v1");
      localStorage.removeItem("maya-onboarding-progress-v1");
    } catch {
      /* ignore */
    }
    try {
      document.cookie = "maya_id=; path=/; max-age=0; SameSite=Lax";
    } catch {
      /* ignore */
    }
    try {
      const keep = sessionStorage.getItem("maya-auto-repaired");
      sessionStorage.clear();
      if (keep) sessionStorage.setItem("maya-auto-repaired", keep);
      sessionStorage.setItem("maya-crash", "1");
    } catch {
      /* ignore */
    }
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    }
    try {
      const regs = await navigator.serviceWorker?.getRegistrations();
      if (regs) {
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      /* ignore */
    }
    try {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("maya-durable-v1");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
        window.setTimeout(() => resolve(), 800);
      });
    } catch {
      /* ignore */
    }
    window.location.replace("/?fix=1");
  }

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          background: "#fff6f8",
          color: "#1a1216",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <p style={{ fontSize: 22, fontWeight: 650, margin: 0 }}>
            Мая споткнулась
          </p>
          <p style={{ fontSize: 14, opacity: 0.7, margin: "10px 0 0" }}>
            Обычно помогает очистить старые данные вкладки и обновить.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
              marginTop: 22,
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: "1px solid #e8d0d8",
                background: "#fff",
                borderRadius: 12,
                padding: "10px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Попробовать снова
            </button>
            <button
              type="button"
              onClick={() => void wipeAndReload()}
              style={{
                border: "none",
                background: "#e85a7a",
                color: "#fff",
                borderRadius: 12,
                padding: "10px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Очистить и открыть заново
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
