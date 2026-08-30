"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { IconBadge } from "@/components/icons/MayaIcon";
import {
  BASE_MONTH_RUB,
  formatRub,
  isSubscriptionActive,
  PAID_ONLY,
} from "@/lib/subscription";
import { getValuePitch } from "@/lib/value-pitch";
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
 * Без Premium — спокойный редирект на выбор тарифа (не стена с замками).
 */
export function PremiumGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const subscription = useAppStore((s) => s.subscription);
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const pregnancy = useAppStore((s) => s.pregnancy);
  const childProfiles = useAppStore((s) => s.children);
  const enabledModules = useAppStore((s) => s.enabledModules);
  const active = isSubscriptionActive(subscription);

  const pitch = useMemo(
    () =>
      getValuePitch({
        pregnant: Boolean(pregnancy?.active),
        hasChild: childProfiles.some(
          (c) => !c.namePending && Boolean(c.birthDate),
        ),
        trackCycle: enabledModules.includes("cycle"),
      }),
    [pregnancy?.active, childProfiles, enabledModules],
  );

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
          Выберите тариф
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          {pitch.intro} Доступ от {formatRub(BASE_MONTH_RUB)} в месяц — после
          оплаты откроется весь сервис.
        </p>
        <ul className="space-y-2 text-left text-sm text-foreground/90">
          {pitch.bullets.slice(0, 4).map((t) => (
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
          К тарифам
        </Link>
      </div>
    </div>
  );
}
