"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

/** Блок «Поставить на экран» — в профиле / меню */
export function InstallAppCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (installed) {
    return (
      <div className="rounded-2xl border border-accent/25 bg-accent-soft/40 px-4 py-3 text-sm">
        <p className="font-semibold text-foreground">Мая на телефоне</p>
        <p className="mt-1 text-xs text-muted">
          Уже как приложение — открываете с иконки на экране.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card/70 px-4 py-4">
      <p className="font-display text-lg font-semibold tracking-tight">
        Мая как приложение
      </p>
      <p className="mt-1 text-sm text-muted">
        Иконка на рабочий стол — без магазина. Ставьте из того же браузера, где
        уже пользуетесь Маей (Chrome / Edge / Safari) — тогда профиль не
        потеряется.
      </p>

      <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/90">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            iPhone / iPad
          </p>
          <p className="mt-1">
            Откройте сайт в <strong>Safari</strong> (не в Chrome) → кнопка{" "}
            <strong>«Поделиться»</strong> (квадрат со стрелкой вверх) →{" "}
            <strong>«На экран „Домой“»</strong> → «Добавить».
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Android
          </p>
          <p className="mt-1">
            В <strong>Chrome</strong>: меню <strong>⋮</strong> → «Установить
            приложение» или «На главный экран».
          </p>
        </div>
      </div>

      {deferred && (
        <button
          type="button"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
            setInstalled(isStandalone());
          }}
          className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white"
        >
          Установить Маю
        </button>
      )}
    </div>
  );
}
