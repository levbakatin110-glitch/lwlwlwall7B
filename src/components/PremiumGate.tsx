"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isSubscriptionActive, PAID_ONLY } from "@/lib/subscription";
import { useAppStore } from "@/lib/store";

/** Юр. и админ — без подписки. Тарифы — только после онбординга. */
const ALLOW_WITHOUT_PREMIUM = ["/legal", "/admin"];

function isAllowedPath(pathname: string): boolean {
  return ALLOW_WITHOUT_PREMIUM.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isPricingPath(pathname: string): boolean {
  return pathname === "/pricing" || pathname.startsWith("/pricing/");
}

/**
 * Сначала все шаги онбординга, потом тарифы.
 * Без оплаты в приложение не пускаем.
 */
export function PremiumGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const subscription = useAppStore((s) => s.subscription);
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const active = isSubscriptionActive(subscription);

  useEffect(() => {
    if (!PAID_ONLY) return;

    // Тарифы до конца анкеты — на главную, чтобы прошли шаги
    if (!onboardingDone && isPricingPath(pathname)) {
      router.replace("/");
      return;
    }

    if (!onboardingDone) return;
    if (active) return;
    if (isAllowedPath(pathname) || isPricingPath(pathname)) return;

    router.replace("/pricing");
  }, [onboardingDone, active, pathname, router]);

  if (!PAID_ONLY || !onboardingDone || active || isAllowedPath(pathname)) {
    return <>{children}</>;
  }

  if (isPricingPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted">
      Мая…
    </div>
  );
}
