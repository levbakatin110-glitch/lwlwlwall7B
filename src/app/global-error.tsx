"use client";

import { useEffect } from "react";

/**
 * Ловит падение root layout.
 * Не стирает localStorage сама — иначе любой сбой = снова анкета.
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
            Данные не трогаем. Обнови страницу или зайди на главную.
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
                window.location.href = "/";
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
