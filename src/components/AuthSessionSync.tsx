"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics-client";
import { useAppStore } from "@/lib/store";

function waitHydration(): Promise<void> {
  if (useAppStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useAppStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

async function completeOAuthTicket(ticket: string): Promise<string | null> {
  const res = await fetch("/api/auth/oauth/complete", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket }),
  });
  const data = (await res.json()) as { error?: string; email?: string };
  if (!res.ok) throw new Error(data.error || "Не удалось войти");
  return data.email ?? null;
}

/** Сессия с сервера + глобальный OAuth ticket (cookie после входа). */
export function AuthSessionSync() {
  const setAccountEmail = useAppStore((s) => s.setAccountEmail);
  const clearAccountEmail = useAppStore((s) => s.clearAccountEmail);
  const oauthHandled = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await waitHydration();
      if (cancelled) return;

      if (sessionStorage.getItem("maya-signing-out")) {
        sessionStorage.removeItem("maya-signing-out");
        clearAccountEmail();
        return;
      }

      if (typeof window !== "undefined" && !oauthHandled.current) {
        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get("oauth_error");
        if (oauthError) {
          params.delete("oauth_error");
          const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
          window.history.replaceState({}, "", next);
        }

        const ticket = params.get("oauth");
        if (ticket) {
          oauthHandled.current = true;
          try {
            const email = await completeOAuthTicket(ticket);
            if (email && !cancelled) {
              setAccountEmail(email);
              trackEvent("login", params.get("oauth_provider") || undefined);
            }
          } catch {
            /* ticket истёк или уже использован */
          } finally {
            params.delete("oauth");
            params.delete("oauth_provider");
            const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
            window.history.replaceState({}, "", next);
          }
        }
      }

      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { email?: string | null };
        if (data.email) {
          setAccountEmail(data.email);
          return;
        }
        const local = useAppStore.getState();
        if (local.emailVerified || local.accountEmail) {
          clearAccountEmail();
        }
      } catch {
        /* offline */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setAccountEmail, clearAccountEmail]);

  return null;
}
