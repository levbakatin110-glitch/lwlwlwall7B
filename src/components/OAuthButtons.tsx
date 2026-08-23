"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics-client";
import { useAppStore } from "@/lib/store";

type OAuthProvider = "google" | "yandex";

type Props = {
  mode: "login" | "register";
  /** Для регистрации — сначала согласия */
  consentsOk?: boolean;
  returnTo?: string;
  onError?: (message: string) => void;
};

export function OAuthButtons({
  mode,
  consentsOk = true,
  returnTo = "/register",
  onError,
}: Props) {
  const setAccountEmail = useAppStore((s) => s.setAccountEmail);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const handledTicket = useRef(false);
  const [available, setAvailable] = useState<Record<OAuthProvider, boolean>>({
    google: true,
    yandex: true,
  });
  const [busy, setBusy] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/oauth");
        if (!res.ok) return;
        const data = (await res.json()) as Record<OAuthProvider, boolean>;
        if (!cancelled) setAvailable(data);
      } catch {
        /* кнопки всё равно покажем — сервер ответит ошибкой при клике */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || handledTicket.current) return;
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("oauth");
    const oauthError = params.get("oauth_error");
    const provider = params.get("oauth_provider");

    if (oauthError) {
      handledTicket.current = true;
      onErrorRef.current?.(oauthError);
      params.delete("oauth_error");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
      return;
    }

    if (!ticket) return;
    handledTicket.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/oauth/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket }),
        });
        const data = (await res.json()) as { error?: string; email?: string };
        if (!res.ok) throw new Error(data.error || "Не удалось войти");
        if (cancelled) return;
        setAccountEmail(data.email!);
        trackEvent(
          mode === "register" ? "register" : "login",
          provider || undefined,
        );
      } catch (e) {
        if (!cancelled) {
          onErrorRef.current?.(
            e instanceof Error ? e.message : "Ошибка входа",
          );
        }
      } finally {
        params.delete("oauth");
        params.delete("oauth_provider");
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
        window.history.replaceState({}, "", next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, setAccountEmail]);

  async function start(provider: OAuthProvider) {
    if (mode === "register" && !consentsOk) {
      onErrorRef.current?.("Отметьте обязательные согласия под формой");
      return;
    }
    setBusy(provider);
    onErrorRef.current?.("");
    try {
      const res = await fetch("/api/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, mode, returnTo }),
      });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Не удалось начать вход");
      }
      window.location.href = data.url;
    } catch (e) {
      onErrorRef.current?.(e instanceof Error ? e.message : "Ошибка");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative py-2 text-center text-[11px] uppercase tracking-[0.16em] text-muted">
        <span className="relative z-[1] bg-background px-3">или</span>
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
      </div>

      <button
        type="button"
        disabled={busy !== null || (mode === "register" && !consentsOk)}
        onClick={() => void start("google")}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-line bg-card py-3 text-sm font-medium text-foreground transition hover:border-accent/40 disabled:opacity-50"
      >
        <GoogleIcon />
        {busy === "google"
          ? "Перенаправляю…"
          : available.google
            ? "Войти с Google"
            : "Google (нужна настройка)"}
      </button>

      <button
        type="button"
        disabled={busy !== null || (mode === "register" && !consentsOk)}
        onClick={() => void start("yandex")}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-line bg-card py-3 text-sm font-medium text-foreground transition hover:border-accent/40 disabled:opacity-50"
      >
        <YandexIcon />
        {busy === "yandex"
          ? "Перенаправляю…"
          : available.yandex
            ? "Войти с Яндекс ID"
            : "Яндекс ID (нужна настройка)"}
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.3 35.9 26.8 37 24 37c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l.1.1 6.3 5.2C39.4 36.3 44 30.7 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

function YandexIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="5" fill="#FC3F1D" />
      <path
        fill="#fff"
        d="M13.2 18.5h-2.1V5.5h2.7c2.6 0 4.2 1.4 4.2 3.7 0 1.7-1 3-2.5 3.5l3 5.8h-2.4l-2.7-5.4H13.2v5.4zm0-7.3h.6c1.3 0 2.1-.7 2.1-1.9s-.8-1.9-2.1-1.9h-.6v3.8z"
      />
    </svg>
  );
}
