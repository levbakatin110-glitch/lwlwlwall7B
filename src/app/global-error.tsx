"use client";

import { useEffect } from "react";
import { captureBetterStackException } from "@/lib/betterstack-sentry";

/**
 * Падение root layout. Часто это не «баг страницы», а старый JS после деплоя
 * (телефон держит прошлый чанк). Тогда один жёсткий reload чинит.
 * Логика здесь inline — общий импорт сам может не загрузиться.
 */
function isStaleBuildError(error: Error) {
  const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
    msg,
  );
}

function hardReloadOnce() {
  try {
    if (sessionStorage.getItem("maya-chunk-reload") === "1") return;
    sessionStorage.setItem("maya-chunk-reload", "1");
  } catch {
    window.location.reload();
    return;
  }
  const go = () => {
    const u = new URL(window.location.href);
    u.searchParams.set("_r", String(Date.now()));
    window.location.replace(u.toString());
  };
  if (!navigator.serviceWorker?.getRegistrations) {
    go();
    return;
  }
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    Promise.all(regs.map((r) => r.unregister())).finally(go);
  });
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[maya] global error", error);
    captureBetterStackException(error);
    if (isStaleBuildError(error)) hardReloadOnce();
  }, [error]);

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
            Часто это старая версия после обновления сайта. Нажмите «Попробовать
            снова» — подтянем свежий код. Данные не трогаем.
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
              onClick={() => {
                hardReloadOnce();
                reset();
              }}
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
              Попробовать снова
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/?fix=1";
              }}
              style={{
                border: "1px solid #e8d0d8",
                background: "#fff",
                borderRadius: 12,
                padding: "10px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              На главную
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
