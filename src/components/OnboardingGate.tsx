"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
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
    if (raw) {
      const parsed = JSON.parse(raw) as {
        state?: { onboardingDone?: boolean };
        onboardingDone?: boolean;
      };
      const done = parsed?.state?.onboardingDone ?? parsed?.onboardingDone;
      if (done) return true;
    }
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
 * Сам мастер анкеты подгружается только если анкета ещё не пройдена.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const [stickyDone, setStickyDone] = useState(false);
  const [ready, setReady] = useState(false);

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
    if (!onboardingDone) return;
    markOnboardingDoneSticky();
    setStickyDone(true);
  }, [onboardingDone]);

  if (!ready && !stickyDone && !onboardingDone) {
    return <MayaSplash />;
  }

  if (stickyDone || onboardingDone) {
    return <>{children}</>;
  }

  if (!ready) {
    return <MayaSplash />;
  }

  return <OnboardingFlow mode="first" />;
}
