"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { InstallHint } from "./InstallHint";
import { OnboardingGate } from "./OnboardingFlow";
import { Sidebar } from "./Sidebar";
import { ThemeSync } from "./ThemeSync";
import { ThemeToggle } from "./ThemeToggle";
import { WhiteNoisePlayer } from "./WhiteNoisePlayer";
import { childDisplayName } from "@/lib/children";
import { useAppStore } from "@/lib/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOpsPage = pathname === "/admin" || pathname.startsWith("/admin/");
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

  return (
    <OnboardingGate>
      <ThemeSync />
      <div className="flex h-dvh max-h-dvh overflow-hidden bg-background pt-[env(safe-area-inset-top)] text-foreground">
        <Sidebar mobileOpen={menuOpen} onMobileOpenChange={setMenuOpen} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-30 flex shrink-0 items-center gap-2.5 border-b border-line bg-card/90 px-3 py-2.5 backdrop-blur-xl md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="maya-mobile-menu"
              className="relative z-30 rounded-full border border-line bg-accent-soft px-3.5 py-1.5 text-sm font-semibold text-foreground"
            >
              {menuOpen ? "Закрыть" : "Меню"}
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
            <span className="min-w-0 flex-1 truncate font-display text-base font-semibold tracking-tight text-foreground">
              {name}
            </span>
            <ThemeToggle compact />
          </header>
          <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
            {children}
          </main>
        </div>
        <WhiteNoisePlayer />
        <InstallHint />
      </div>
    </OnboardingGate>
  );
}
