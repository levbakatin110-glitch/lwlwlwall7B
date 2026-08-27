"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { InstallHint } from "./InstallHint";
import { AnalyticsVisitBeacon } from "./AnalyticsVisitBeacon";
import { AuthSessionSync } from "./AuthSessionSync";
import { CloudBackupSync } from "./CloudBackupSync";
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isOpsPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLegalPage =
    pathname === "/legal" || pathname.startsWith("/legal/");
  const isCommunity = pathname === "/community";
  const [menuOpen, setMenuOpen] = useState(false);

  const globalSync = (
    <>
      <AuthSessionSync />
      <CloudBackupSync />
    </>
  );

  // Служебная страница — без меню мамского приложения
  if (isOpsPage) {
    return (
      <>
        <ThemeSync />
        {globalSync}
        <div className="min-h-dvh bg-background text-foreground">{children}</div>
      </>
    );
  }

  // Регистрация / юр. документы — на весь экран, без сайдбара и онбординга
  if (pathname === "/register" || isLegalPage) {
    return (
      <>
        <ThemeSync />
        {globalSync}
        <div className="min-h-dvh bg-background text-foreground">{children}</div>
        {isLegalPage ? <CookieBanner /> : null}
      </>
    );
  }

  return (
    <OnboardingGate>
      <ThemeSync />
      <AnalyticsVisitBeacon />
      {globalSync}
      <SubscriptionSync />
      <CookieBanner />
      <div className="flex h-dvh max-h-dvh overflow-hidden overscroll-none bg-background pt-[env(safe-area-inset-top)] text-foreground">
        {!isCommunity && (
          <Sidebar
            mobileOpen={menuOpen}
            onMobileOpenChange={setMenuOpen}
          />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overscroll-none">
          {!isCommunity && (
            <header className="z-30 flex shrink-0 items-center gap-2 border-b border-line bg-card/90 px-2 py-1.5 backdrop-blur-xl md:hidden">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-controls="maya-mobile-menu"
                aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
                className="relative z-30 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-accent-soft text-foreground"
              >
                <MayaIcon name={menuOpen ? "close" : "list"} size={18} />
              </button>
              <QuickNavCarousel />
            </header>
          )}
          {!isCommunity && <PregnancyStatusBanner />}
          <main className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-none pb-[env(safe-area-inset-bottom)]">
            {children}
          </main>
        </div>
        {!isCommunity && (
          <>
            <WhiteNoisePlayer />
            <InstallHint />
          </>
        )}
        <RemindersHost />
      </div>
    </OnboardingGate>
  );
}
