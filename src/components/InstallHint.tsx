"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Календарный день, когда уже показали подсказку (раз в сутки, пока не поставят). */
const SHOWN_DAY_KEY = "maya-install-shown-day";

function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shownToday() {
  try {
    return localStorage.getItem(SHOWN_DAY_KEY) === localDayKey();
  } catch {
    return false;
  }
}

function markShownToday() {
  try {
    localStorage.setItem(SHOWN_DAY_KEY, localDayKey());
  } catch {
    /* ignore */
  }
}

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
    if (shownToday()) return;

    const reveal = () => {
      if (shownToday()) return;
      markShownToday();
      setVisible(true);
    };

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      reveal();
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // Не сразу при первом заходе, после онбординга, с небольшой паузой
    const t = window.setTimeout(() => {
      if (isIos()) {
        setShowIos(true);
        reveal();
      } else if (isAndroid()) {
        // Chrome сам даст beforeinstallprompt; если нет, ручная подсказка
        setShowAndroidManual(true);
        reveal();
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
    markShownToday();
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
              ? "Safari → Поделиться → «На экран Домой». Иконка на телефоне, без App Store."
              : deferred
                ? "Поставьте иконку из этого же браузера, профиль сохранится, без магазина."
                : showAndroidManual
                  ? "В Chrome: меню ⋮ → «Установить приложение» или «На главный экран»."
                  : "Добавьте на рабочий стол из этого браузера, Мая вас помнит."}
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
