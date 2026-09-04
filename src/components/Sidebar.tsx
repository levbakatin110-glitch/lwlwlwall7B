"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { MayaIcon, type IconName } from "@/components/icons/MayaIcon";
import { SidebarHeader } from "@/components/SidebarHeader";
import { SketchCorner, SketchSprig } from "@/components/illustrations/MayaSketch";
import { childDisplayName } from "@/lib/children";
import {
  filterModulesForNav,
  hasBornChild,
} from "@/lib/module-audience";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { MODULE_BY_ID, customToDef } from "@/lib/modules";
import { isRecipesCatalogModule } from "@/lib/recipes";
import { isSubscriptionActive, PAID_ONLY } from "@/lib/subscription";
import { useAppStore } from "@/lib/store";
import type { ModuleId } from "@/lib/types";
import { showPaywallHint } from "@/components/PaywallHint";
import type { MouseEvent } from "react";

const SUPPORT_MAIL = `mailto:${LEGAL_OPERATOR.supportEmail}`;

function isOpenWithoutPay(href: string): boolean {
  return (
    href === "/pricing" ||
    href.startsWith("/pricing/") ||
    href === "/legal" ||
    href.startsWith("/legal/") ||
    href.startsWith("mailto:")
  );
}

const TALK: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Чат с Маей", icon: "chat" },
  { href: "/community", label: "Круг мам", icon: "circle" },
];

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/summary", label: "Итоги дня", icon: "list" },
  { href: "/pricing", label: "Подписка", icon: "spark" },
];

const PREGNANCY_PINNED: {
  href: string;
  label: string;
  icon: IconName;
  moduleId?: ModuleId;
}[] = [
  { href: "/m/pregnancy", label: "Беременность", icon: "spark", moduleId: "pregnancy" },
  { href: "/m/contractions", label: "Схватки", icon: "pulse", moduleId: "contractions" },
  { href: "/m/kicks", label: "Шевеления", icon: "moments", moduleId: "kicks" },
  { href: "/m/preg_pressure", label: "Давление", icon: "pulse", moduleId: "preg_pressure" },
  { href: "/m/preg_symptoms", label: "Самочувствие", icon: "health", moduleId: "preg_symptoms" },
  { href: "/m/preg_visits", label: "Визиты", icon: "list", moduleId: "preg_visits" },
  { href: "/m/preg_belly", label: "Животик", icon: "outfit", moduleId: "preg_belly" },
  { href: "/m/preg_meds", label: "Лекарства", icon: "health", moduleId: "preg_meds" },
  { href: "/m/preg_labs", label: "Анализы", icon: "list", moduleId: "preg_labs" },
  { href: "/m/preg_sleep", label: "Сон мамы", icon: "sleep", moduleId: "preg_sleep" },
  { href: "/m/birth_plan", label: "План родов", icon: "spark", moduleId: "birth_plan" },
  { href: "/m/cycle", label: "Цикл", icon: "pulse", moduleId: "cycle" },
];

const BABY_PINNED: {
  href: string;
  label: string;
  icon: IconName;
  moduleId?: ModuleId;
}[] = [
  { href: "/m/growth", label: "Рост и вес малыша", icon: "growth", moduleId: "growth" },
  { href: "/m/vaccines", label: "Прививки", icon: "vaccines", moduleId: "vaccines" },
  { href: "/m/sleep", label: "Сон", icon: "sleep", moduleId: "sleep" },
  { href: "/m/breastfeeding", label: "ГВ · таймер", icon: "feeding", moduleId: "breastfeeding" },
  { href: "/m/formula", label: "Смеси", icon: "formula", moduleId: "formula" },
  { href: "/m/solids", label: "Прикорм", icon: "solids", moduleId: "solids" },
  { href: "/m/health", label: "Здоровье", icon: "health", moduleId: "health" },
  { href: "/m/water", label: "Вода", icon: "water", moduleId: "water" },
  { href: "/m/walk", label: "Прогулка", icon: "walk", moduleId: "walk" },
  { href: "/m/diaper", label: "Подгузник", icon: "diaper", moduleId: "diaper" },
  { href: "/wardrobe", label: "Одежда", icon: "wardrobe" },
  { href: "/recipes", label: "Рецепты", icon: "diet" },
];

export function Sidebar({
  mobileOpen = false,
  onMobileOpenChange,
}: {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}) {
  const pathname = usePathname() ?? "";
  const enabledModules = useAppStore((s) => s.enabledModules ?? []);
  const customModules = useAppStore((s) => s.customModules ?? []);
  const childrenList = useAppStore((s) => s.children ?? []);
  const pregnancy = useAppStore((s) => s.pregnancy);
  const activeChildId = useAppStore((s) => s.activeChildId);
  const switchChild = useAppStore((s) => s.switchChild);
  const subscription = useAppStore((s) => s.subscription);
  const paywalled = PAID_ONLY && !isSubscriptionActive(subscription);
  const [mounted, setMounted] = useState(false);
  const [canCloseBackdrop, setCanCloseBackdrop] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mobileOpen) {
      setCanCloseBackdrop(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => setCanCloseBackdrop(true), 350);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileOpenChange?.(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileOpenChange]);

  const close = () => onMobileOpenChange?.(false);

  function onNavClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
    close();
    if (!paywalled || isOpenWithoutPay(href)) return;
    e.preventDefault();
    showPaywallHint("Сначала оформите подписку");
  }

  const audience = {
    pregnant: Boolean(pregnancy?.active),
    hasChild: hasBornChild(childrenList),
  };
  const navModules = new Set(filterModulesForNav(enabledModules, audience));

  const pinnedIds = new Set(
    [...PREGNANCY_PINNED, ...BABY_PINNED]
      .map((p) => p.moduleId)
      .filter(Boolean) as ModuleId[],
  );

  function visibleRows(
    rows: {
      href: string;
      label: string;
      icon: IconName;
      moduleId?: ModuleId;
    }[],
  ) {
    return rows.filter((item) => {
      if (item.href === "/wardrobe") return audience.hasChild;
      if (!item.moduleId) return true;
      return navModules.has(item.moduleId);
    });
  }

  const pregnancyRows = visibleRows(PREGNANCY_PINNED);
  const babyRows = visibleRows(BABY_PINNED);

  const extraDiaries = [
    ...enabledModules
      .filter((id) => navModules.has(id) && !pinnedIds.has(id))
      .map((id) => MODULE_BY_ID[id])
      .filter(Boolean),
    ...customModules
      .map(customToDef)
      .filter((mod) => !isRecipesCatalogModule(mod)),
  ];

  const linkClass = (active: boolean) =>
    `flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium tracking-tight transition ${
      active
        ? "bg-accent-soft text-foreground ring-1 ring-line"
        : "text-muted hover:bg-card hover:text-foreground"
    }`;

  const brand = (
    <div className="relative overflow-hidden">
      <SketchSprig
        tone="soft"
        className="pointer-events-none absolute -right-3 -top-4 h-24 w-16 opacity-80"
      />
      <SketchCorner
        tone="soft"
        className="pointer-events-none absolute -bottom-1 -left-1 h-14 w-14 opacity-70"
      />
      <div className="relative z-[1]">
        <SidebarHeader onNavigate={close} />
      </div>
    </div>
  );
  const brandMobile = (
    <SidebarHeader
      onNavigate={close}
      trailing={
        <button
          type="button"
          onClick={close}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-accent-soft hover:text-foreground"
          aria-label="Закрыть"
        >
          <MayaIcon name="close" size={18} />
        </button>
      }
    />
  );

  function sectionLabel(text: string) {
    return (
      <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {text}
      </p>
    );
  }

  function navLinks(items: { href: string; label: string; icon: IconName }[]) {
    return items.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        onClick={(e) => onNavClick(e, item.href)}
        className={linkClass(
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`),
        )}
      >
        <MayaIcon name={item.icon} size={17} />
        <span>{item.label}</span>
      </Link>
    ));
  }

  const childSwitcher =
    childrenList.length > 1 ? (
      <div className="mb-1">
        {sectionLabel("Дети")}
        <div className="flex flex-col gap-0.5">
          {childrenList.map((c) => {
            const active = c.id === activeChildId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => switchChild(c.id)}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                  active ? "bg-accent-soft ring-1 ring-line" : "hover:bg-card"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-background">
                  {c.photoData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.photoData}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="m-auto text-[11px] font-semibold text-muted">
                      {childDisplayName(c).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span
                  className={`truncate text-[13px] font-medium ${
                    active ? "text-foreground" : "text-muted"
                  }`}
                >
                  {childDisplayName(c)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  const nav = (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-3">
      {childSwitcher}

      <div className={childSwitcher ? "mt-4 border-t border-line/70 pt-3.5" : ""}>
        {sectionLabel("Общение")}
        <div className="flex flex-col gap-0.5">{navLinks(TALK)}</div>
      </div>

      <div className="mt-4 border-t border-line/70 pt-3.5">
        {sectionLabel("Навигация")}
        <div className="flex flex-col gap-0.5">
          {navLinks(NAV)}
          <a
            href={SUPPORT_MAIL}
            onClick={(e) => onNavClick(e, SUPPORT_MAIL)}
            className={linkClass(false)}
            title={LEGAL_OPERATOR.supportEmail}
          >
            <MayaIcon name="notes" size={17} />
            <span>Поддержка</span>
          </a>
        </div>
      </div>

      <div className="mt-4 border-t border-line/70 pt-3.5">
        {sectionLabel("Разделы")}
        <div className="flex flex-col gap-0.5">
          <Link
            href="/modules"
            onClick={(e) => onNavClick(e, "/modules")}
            className={`mb-0.5 flex items-center gap-2.5 rounded-xl border border-dashed border-accent/45 bg-accent-soft/50 px-2.5 py-2.5 text-[13px] font-semibold tracking-tight text-accent transition hover:border-accent/70 hover:bg-accent-soft ${
              pathname === "/modules" || pathname.startsWith("/modules/")
                ? "ring-1 ring-accent/35"
                : ""
            }`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[var(--on-accent,#fff)]">
              <MayaIcon name="plus" size={15} />
            </span>
            <span className="min-w-0 flex-1">Все дневники</span>
          </Link>
          {babyRows.length > 0 ? (
            <>
              <p className="mb-1 mt-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Малыш
              </p>
              {babyRows.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => onNavClick(e, item.href)}
                  className={linkClass(
                    pathname === item.href || pathname.startsWith(`${item.href}/`),
                  )}
                >
                  <MayaIcon name={item.icon} size={17} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          ) : null}
          {pregnancyRows.length > 0 ? (
            <>
              <p className="mb-1 mt-3 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Беременность
              </p>
              {pregnancyRows.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => onNavClick(e, item.href)}
                  className={linkClass(
                    pathname === item.href || pathname.startsWith(`${item.href}/`),
                  )}
                >
                  <MayaIcon name={item.icon} size={17} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          ) : null}
          {extraDiaries.map((mod) => {
            const href = `/m/${mod.id}`;
            return (
              <Link
                key={mod.id}
                href={href}
                onClick={(e) => onNavClick(e, href)}
                className={linkClass(pathname === href)}
              >
                <MayaIcon name={mod.icon} size={17} />
                <span>{mod.shortTitle}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <Link
        href="/legal"
        onClick={(e) => onNavClick(e, "/legal")}
        className="mt-5 px-2.5 text-[11px] text-muted underline underline-offset-2 hover:text-foreground"
      >
        Документы · оферта
      </Link>
    </nav>
  );

  const mobileDrawer =
    mounted &&
    mobileOpen &&
    createPortal(
      <div
        className="fixed inset-0"
        style={{ zIndex: 99999 }}
        role="dialog"
        aria-modal="true"
        aria-label="Меню"
      >
        <button
          type="button"
          className="absolute inset-0"
          style={{ background: "var(--overlay)" }}
          aria-label="Закрыть меню"
          onClick={() => {
            if (canCloseBackdrop) close();
          }}
        />
        <aside
          id="maya-mobile-menu"
          className="absolute left-0 top-0 flex h-full min-h-0 w-[min(82%,20rem)] flex-col overflow-hidden bg-card shadow-2xl ring-1 ring-line"
          style={{ animation: "maya-drawer-in 0.28s ease-out both" }}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-line px-4 py-4">
              {brandMobile}
            </div>
            {nav}
          </div>
        </aside>
      </div>,
      document.body,
    );

  return (
    <>
      <aside className="hidden h-full min-h-0 w-[17.5rem] shrink-0 flex-col overflow-hidden border-r border-line bg-sidebar/95 backdrop-blur-xl md:flex">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-line px-4 py-4">{brand}</div>
          {nav}
        </div>
      </aside>
      {mobileDrawer}
    </>
  );
}
