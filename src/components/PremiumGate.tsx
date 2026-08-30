"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { IconBadge } from "@/components/icons/MayaIcon";
import {
  BASE_MONTH_RUB,
  formatRub,
  isSubscriptionActive,
  PAID_ONLY,
  PAID_PERKS,
} from "@/lib/subscription";
import { useAppStore } from "@/lib/store";

const ALLOW_WITHOUT_PREMIUM = [
  "/pricing",
  "/legal",
  "/register",
  "/admin",
];

function isAllowedPath(pathname: string): boolean {
  return ALLOW_WITHOUT_PREMIUM.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Без Premium весь сервис закрыт (кроме тарифов и юр. страниц).
 */
export function PremiumGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const subscription = useAppStore((s) => s.subscription);
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const active = isSubscriptionActive(subscription);

  const mustPay =
    PAID_ONLY && onboardingDone && !active && !isAllowedPath(pathname);

  useEffect(() => {
    if (!mustPay) return;
    if (pathname === "/pricing") return;
    router.replace("/pricing");
  }, [mustPay, pathname, router]);

  if (!PAID_ONLY || active || isAllowedPath(pathname) || !onboardingDone) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-12 text-foreground">
      <div className="w-full max-w-md space-y-5 text-center">
        <IconBadge name="spark" />
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Нужна подписка
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Бесплатной версии нет. Мая, дневники и общение — после оплаты Premium
          от {formatRub(BASE_MONTH_RUB)} в месяц.
        </p>
        <ul className="space-y-2 text-left text-sm text-foreground/90">
          {PAID_PERKS.slice(0, 4).map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-accent">✓</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <Link
          href="/pricing"
          className="inline-flex w-full items-center justify-center rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[var(--on-accent,#fff)]"
        >
          Выбрать тариф
        </Link>
      </div>
    </div>
  );
}
