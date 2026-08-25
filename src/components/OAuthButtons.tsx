"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics-client";
import { useAppStore } from "@/lib/store";

type Props = {
  mode: "login" | "register";
  consentsOk?: boolean;
  returnTo?: string;
  onError?: (message: string) => void;
  onBeforeRedirect?: () => void;
};

export function OAuthButtons({
  mode,
  consentsOk = true,
  returnTo = "/register",
  onError,
  onBeforeRedirect,
}: Props) {
  const setAccountEmail = useAppStore((s) => s.setAccountEmail);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const handledTicket = useRef(false);
  const [mailruOk, setMailruOk] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/oauth");
        if (!res.ok) return;
        const data = (await res.json()) as { mailru?: boolean };
        if (!cancelled) setMailruOk(Boolean(data.mailru));
      } catch {
        /* ok */
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

  async function startMailru() {
    if (mode === "register" && !consentsOk) {
      onErrorRef.current?.("Отметьте обязательные согласия под формой");
      return;
    }
    setBusy(true);
    onErrorRef.current?.("");
    try {
      onBeforeRedirect?.();
      const res = await fetch("/api/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "mailru", mode, returnTo }),
      });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Не удалось начать вход");
      }
      window.location.href = data.url;
    } catch (e) {
      onErrorRef.current?.(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative py-2 text-center text-[11px] uppercase tracking-[0.16em] text-muted">
        <span className="relative z-[1] bg-background px-3">или быстро</span>
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
      </div>

      <button
        type="button"
        disabled={busy || (mode === "register" && !consentsOk)}
        onClick={() => void startMailru()}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-line bg-card py-3 text-sm font-medium text-foreground transition hover:border-accent/40 disabled:opacity-50"
      >
        <MailRuIcon />
        {busy
          ? "Перенаправляю…"
          : mailruOk
            ? "Войти с Mail.ru"
            : "Mail.ru (нужна настройка)"}
      </button>
    </div>
  );
}

function MailRuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="5" fill="#005FF9" />
      <path
        fill="#fff"
        d="M6.5 8.2h11c.6 0 1 .4 1 1v5.6c0 .6-.4 1-1 1h-11c-.6 0-1-.4-1-1V9.2c0-.6.4-1 1-1zm.4 1.3v.4l5.1 3.1 5.1-3.1v-.4H6.9zm0 1.6V14h10.2v-2.9l-4.7 2.8c-.3.2-.7.2-1 0L6.9 11.1z"
      />
    </svg>
  );
}
