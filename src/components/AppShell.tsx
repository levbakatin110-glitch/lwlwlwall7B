"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { InstallHint } from "./InstallHint";
import { AnalyticsVisitBeacon } from "./AnalyticsVisitBeacon";
import { OnboardingGate } from "./OnboardingFlow";
import { QuickNavCarousel } from "./QuickNavCarousel";
import { RemindersHost } from "./RemindersHost";
import { SubscriptionSync } from "./SubscriptionSync";
import { Sidebar } from "./Sidebar";
import { ThemeSync } from "./ThemeSync";
import { WhiteNoisePlayer } from "./WhiteNoisePlayer";
import { CookieBanner } from "./legal/CookieBanner";
import { PregnancyStatusBanner } from "./pregnancy/PregnancyStatusBanner";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { childDisplayName } from "@/lib/children";
import { useAppStore } from "@/lib/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOpsPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLegalPage =
    pathname === "/legal" || pathname.startsWith("/legal/");
  const [menuOpen, setMenuOpen] = useState(false);
  const profile = useAppStore((s) => s.profile);
  const name = childDisplayName(profile);
  const initial = name.slice(0, 1).toUpperCase();

  // Служебная страница — без меню мамского приложения
  if (isOpsPage) {
    return (
      <>
        <ThemeSync />
        <div className="min-h-dvh bg-background text-foreground">{children}</div>
      </>
    );
  }

  // Регистрация / юр. документы — на весь экран, без сайдбара и онбординга
  if (pathname === "/register" || isLegalPage) {
    return (
      <>
        <ThemeSync />
        <div className="min-h-dvh bg-background text-foreground">{children}</div>
        {isLegalPage ? <CookieBanner /> : null}
      </>
    );
  }

  return (
    <OnboardingGate>
      <ThemeSync />
      <AnalyticsVisitBeacon />
      <SubscriptionSync />
      <CookieBanner />
      <div className="flex h-dvh max-h-dvh overflow-hidden bg-background pt-[env(safe-area-inset-top)] text-foreground">
        <Sidebar mobileOpen={menuOpen} onMobileOpenChange={setMenuOpen} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-30 flex shrink-0 items-center gap-2 border-b border-line bg-card/90 px-2.5 py-2 backdrop-blur-xl md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="maya-mobile-menu"
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              className="relative z-30 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-accent-soft text-foreground"
            >
              <MayaIcon name={menuOpen ? "close" : "list"} size={18} />
            </button>
            <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-accent-soft ring-1 ring-line">
              {profile.photoData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoData}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="m-auto text-[11px] font-semibold text-accent">
                  {initial}
                </span>
              )}
            </span>
            <span className="max-w-[4.75rem] shrink-0 truncate font-display text-[15px] font-semibold tracking-tight text-foreground">
              {name}
            </span>
            <QuickNavCarousel />
          </header>
          <PregnancyStatusBanner />
          <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
            {children}
          </main>
        </div>
        <WhiteNoisePlayer />
        <InstallHint />
        <RemindersHost />
      </div>
    </OnboardingGate>
  );
}
