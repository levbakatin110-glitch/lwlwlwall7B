"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics-client";
import { useAppStore } from "@/lib/store";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushReminders() {
  const emailVerified = useAppStore((s) => s.emailVerified);
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const [prompt, setPrompt] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (!onboardingDone || !emailVerified) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      void subscribePush();
      return;
    }
    if (Notification.permission === "denied") return;
    try {
      if (localStorage.getItem("maya-push-dismissed") === "1") return;
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setPrompt(true), 6000);
    return () => window.clearTimeout(t);
  }, [onboardingDone, emailVerified]);

  async function enable() {
    asked.current = true;
    setPrompt(false);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        localStorage.setItem("maya-push-dismissed", "1");
        return;
      }
      trackEvent("push_enable");
      await subscribePush();
      await showLocalNotice(
        "Мая",
        "Уведомления включены. Напомню, когда свернёте сайт.",
        "/reminders",
      );
    } catch {
      /* ignore */
    }
  }

  function later() {
    setPrompt(false);
    try {
      localStorage.setItem("maya-push-dismissed", "1");
    } catch {
      /* ignore */
    }
  }

  if (!prompt) return null;

  return (
    <div className="fixed inset-x-0 bottom-[4.5rem] z-40 px-3 md:bottom-6">
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-accent/30 bg-card/95 p-3.5 shadow-lg backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Напоминания на телефоне</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Разрешите уведомления — Мая напомнит покормить, уложить и про
            лекарство на экране телефона, когда сайт свёрнут. На открытой
            вкладке ничего не всплывает. На iPhone: сначала «На экран Домой».
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => void enable()}
              className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white"
            >
              Включить
            </button>
            <button
              type="button"
              onClick={later}
              className="rounded-xl border border-line px-3 py-1.5 text-xs text-muted"
            >
              Позже
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SW_URL = "/sw.js?v=17";

export async function showLocalNotice(
  title: string,
  body: string,
  url = "/",
  tag = "maya",
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register(SW_URL);
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        tag,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url },
      });
      return;
    }
  } catch {
    /* */
  }
  try {
    new Notification(title, { body, tag, icon: "/icons/icon-192.png" });
  } catch {
    /* */
  }
}

export async function subscribePush() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    await navigator.serviceWorker.register(SW_URL);
    const reg = await navigator.serviceWorker.ready;
    const vapid = (await fetch("/api/push/vapid").then((r) => r.json())) as {
      publicKey?: string | null;
    };
    let sub = await reg.pushManager.getSubscription();
    if (!sub && vapid.publicKey) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
    }
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    }
  } catch {
    /* iOS без установленного PWA / нет VAPID */
  }
}

export function notifyViaSw(input: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}) {
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    return;
  }
  void showLocalNotice(
    input.title,
    input.body,
    input.url || "/",
    input.tag || "maya",
  );
}
