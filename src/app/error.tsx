"use client";

import { useEffect } from "react";

/** Ловит падения React на маршруте — вместо «This page couldn't load» */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[maya] route error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50dvh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-display text-2xl font-semibold tracking-tight">
        Страница споткнулась
      </p>
      <p className="mt-2 text-sm text-muted">
        Запись обычно уже сохранена. Можно обновить экран.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[var(--on-accent,#fff)]"
        >
          Попробовать снова
        </button>
        <button
          type="button"
          onClick={() => window.location.assign("/")}
          className="rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium"
        >
          В чат
        </button>
      </div>
    </div>
  );
}
