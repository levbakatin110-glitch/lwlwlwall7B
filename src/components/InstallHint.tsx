"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "maya-install-dismissed-v2";
const VISITS_KEY = "maya-install-visits";

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function InstallHint() {
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showIos, setShowIos] = useState(false);
  const [showAndroidManual, setShowAndroidManual] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!onboardingDone) return;
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      const visits = Number(localStorage.getItem(VISITS_KEY) || "0") + 1;
      localStorage.setItem(VISITS_KEY, String(visits));
    } catch {
      /* ignore */
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // Не сразу при первом заходе — после онбординга, с небольшой паузой
    const t = window.setTimeout(() => {
      if (isIos()) {
        setShowIos(true);
        setVisible(true);
      } else if (isAndroid()) {
        // Chrome сам даст beforeinstallprompt; если нет — ручная подсказка
        setShowAndroidManual(true);
        setVisible(true);
      }
    }, 4500);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBip);
    };
  }, [onboardingDone]);

  if (!visible || !onboardingDone) return null;

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-accent/25 bg-card/95 p-3.5 shadow-lg backdrop-blur-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt=""
          className="h-11 w-11 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Мая как приложение
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {showIos && !deferred
              ? "Safari → Поделиться → «На экран Домой». Иконка на телефоне — без App Store."
              : deferred
                ? "Поставьте иконку из этого же браузера — профиль сохранится, без магазина."
                : showAndroidManual
                  ? "В Chrome: меню ⋮ → «Установить приложение» или «На главный экран»."
                  : "Добавьте на рабочий стол из этого браузера — Мая вас помнит."}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {deferred && (
              <button
                type="button"
                onClick={() => void install()}
                className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white"
              >
                Установить
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-medium text-muted"
            >
              Позже
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
