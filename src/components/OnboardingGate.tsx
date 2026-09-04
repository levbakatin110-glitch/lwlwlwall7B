"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { restoreCloudBackup } from "@/components/CloudBackupSync";
import {
  markOnboardingDoneSticky,
  readIdentityBackup,
  readOnboardingDoneSticky,
} from "@/lib/identity-backup";
import { useAppStore } from "@/lib/store";

function MayaSplash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted">
      Мая…
    </div>
  );
}

const OnboardingFlow = dynamic(
  () => import("./OnboardingFlow").then((m) => m.OnboardingFlow),
  { ssr: false, loading: () => <MayaSplash /> },
);

function peekLikelyOnboarded(): boolean {
  try {
    if (readOnboardingDoneSticky()) return true;
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem("maya-mom-ai");
    // не JSON.parse всего стора — на телефоне это подвисает
    if (raw && raw.includes('"onboardingDone":true')) return true;
  } catch {
    /* ignore */
  }
  try {
    const id = readIdentityBackup();
    if (id?.onboardingDone) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Показывает онбординг новым пользователям.
 * Если уже есть сессия (иконка на рабочем столе) — тянем бэкап, анкету не просим.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const [stickyDone, setStickyDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [sessionProbeDone, setSessionProbeDone] = useState(false);

  useEffect(() => {
    let likely = false;
    try {
      likely = peekLikelyOnboarded();
      if (likely) setStickyDone(true);
    } catch {
      /* ignore */
    }

    const finish = () => {
      try {
        if (peekLikelyOnboarded()) setStickyDone(true);
      } catch {
        /* ignore */
      }
      setReady(true);
    };

    if (likely) {
      setReady(true);
    }

    if (useAppStore.persist.hasHydrated()) {
      finish();
      return;
    }
    const unsub = useAppStore.persist.onFinishHydration(finish);
    const t = window.setTimeout(finish, 600);
    return () => {
      unsub();
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { email?: string | null };
          if (data.email) {
            useAppStore.getState().setAccountEmail(data.email);
            await restoreCloudBackup();
            if (!cancelled) {
              if (!useAppStore.getState().onboardingDone) {
                useAppStore.getState().completeOnboarding();
              }
              setStickyDone(true);
            }
          }
        }
      } catch {
        /* offline */
      }
      if (!cancelled) setSessionProbeDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!onboardingDone) return;
    markOnboardingDoneSticky();
    setStickyDone(true);
  }, [onboardingDone]);

  if (stickyDone || onboardingDone) {
    return <>{children}</>;
  }

  if (!ready || !sessionProbeDone) {
    return <MayaSplash />;
  }

  return <OnboardingFlow mode="first" />;
}
