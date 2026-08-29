"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { MayaIcon, type IconName } from "@/components/icons/MayaIcon";
import { SidebarHeader } from "@/components/SidebarHeader";
import { SketchCorner, SketchSprig } from "@/components/illustrations/MayaSketch";
import { childDisplayName } from "@/lib/children";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { MODULE_BY_ID, customToDef } from "@/lib/modules";
import { useAppStore } from "@/lib/store";
import type { ModuleId } from "@/lib/types";

const SUPPORT_MAIL = `mailto:${LEGAL_OPERATOR.supportEmail}`;

const CORE: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Чат с Маей", icon: "chat" },
  { href: "/community", label: "Общение", icon: "circle" },
  { href: "/summary", label: "Итоги дня", icon: "list" },
  { href: "/med", label: "Мед. карта", icon: "health" },
  { href: "/pricing", label: "Подписка", icon: "spark" },
  { href: "/profile", label: "Профиль", icon: "profile" },
];

const PINNED_DIARIES: {
  href: string;
  label: string;
  icon: IconName;
  moduleId?: ModuleId;
}[] = [
  { href: "/m/pregnancy", label: "Беременность", icon: "spark", moduleId: "pregnancy" },
  { href: "/m/contractions", label: "Схватки", icon: "pulse", moduleId: "contractions" },
  { href: "/m/kicks", label: "Шевеления", icon: "moments", moduleId: "kicks" },
  { href: "/m/preg_weight", label: "Вес мамы", icon: "growth", moduleId: "preg_weight" },
  { href: "/m/preg_pressure", label: "Давление", icon: "pulse", moduleId: "preg_pressure" },
  { href: "/m/preg_symptoms", label: "Самочувствие", icon: "health", moduleId: "preg_symptoms" },
  { href: "/m/preg_visits", label: "Визиты", icon: "list", moduleId: "preg_visits" },
  { href: "/m/preg_belly", label: "Животик", icon: "outfit", moduleId: "preg_belly" },
  { href: "/m/preg_meds", label: "Лекарства", icon: "health", moduleId: "preg_meds" },
  { href: "/m/preg_labs", label: "Анализы", icon: "list", moduleId: "preg_labs" },
  { href: "/m/preg_docs", label: "Документы", icon: "list", moduleId: "preg_docs" },
  { href: "/m/preg_sleep", label: "Сон мамы", icon: "sleep", moduleId: "preg_sleep" },
  { href: "/m/birth_plan", label: "План родов", icon: "spark", moduleId: "birth_plan" },
  { href: "/m/cycle", label: "Цикл", icon: "pulse", moduleId: "cycle" },
  { href: "/m/growth", label: "Рост и вес", icon: "growth", moduleId: "growth" },
  { href: "/m/vaccines", label: "Прививки", icon: "vaccines", moduleId: "vaccines" },
  { href: "/m/sleep", label: "Сон", icon: "sleep", moduleId: "sleep" },
  { href: "/m/breastfeeding", label: "ГВ · таймер", icon: "feeding", moduleId: "breastfeeding" },
  { href: "/m/formula", label: "Смеси", icon: "formula", moduleId: "formula" },
  { href: "/m/water", label: "Вода", icon: "water", moduleId: "water" },
  { href: "/m/walk", label: "Прогулка", icon: "walk", moduleId: "walk" },
  { href: "/m/diaper", label: "Подгузник", icon: "diaper", moduleId: "diaper" },
  { href: "/m/notes", label: "Заметки", icon: "notes", moduleId: "notes" },
  { href: "/m/diet", label: "Диета", icon: "diet", moduleId: "diet" },
  { href: "/wardrobe", label: "Гардероб", icon: "wardrobe" },
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
  const activeChildId = useAppStore((s) => s.activeChildId);
  const profile = useAppStore((s) => s.profile);
  const switchChild = useAppStore((s) => s.switchChild);
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

  const pinnedIds = new Set(
    PINNED_DIARIES.map((p) => p.moduleId).filter(Boolean) as ModuleId[],
  );

  /** Закреплённые дневники — только если раздел включён (Гардероб всегда) */
  const visiblePinned = PINNED_DIARIES.filter(
    (item) => !item.moduleId || enabledModules.includes(item.moduleId),
  );

  const extraDiaries = [
    ...enabledModules
      .filter((id) => !pinnedIds.has(id))
      .map((id) => MODULE_BY_ID[id])
      .filter(Boolean),
    ...customModules.map(customToDef),
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
        <SidebarHeader />
      </div>
    </div>
  );
  const brandMobile = (
    <SidebarHeader
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

  const childSwitcher = (
    <div className="mb-4 px-1">
      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        Сейчас
      </p>
      <div className="flex flex-col gap-1">
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
      <Link
        href="/profile"
        onClick={close}
        className="mt-1.5 block px-2.5 text-[11px] font-semibold text-accent hover:underline"
      >
        + Ещё ребёнок / профиль
      </Link>
    </div>
  );

  const nav = (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-3">
      {childSwitcher}
      <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        Навигация
      </p>
      {CORE.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={close}
          className={linkClass(
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`),
          )}
        >
          <MayaIcon name={item.icon} size={17} />
          <span>{item.label}</span>
        </Link>
      ))}
      <a
        href={SUPPORT_MAIL}
        onClick={close}
        className={linkClass(false)}
        title={LEGAL_OPERATOR.supportEmail}
      >
        <MayaIcon name="notes" size={17} />
        <span>Поддержка</span>
      </a>

      <p className="mb-1.5 mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        {childDisplayName(profile)}
      </p>
      <Link
        href="/modules"
        onClick={close}
        className={`mb-1 flex items-center gap-2.5 rounded-xl border border-dashed border-accent/45 bg-accent-soft/50 px-2.5 py-2.5 text-[13px] font-semibold tracking-tight text-accent transition hover:border-accent/70 hover:bg-accent-soft ${
          pathname === "/modules" || pathname.startsWith("/modules/")
            ? "ring-1 ring-accent/35"
            : ""
        }`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[var(--on-accent,#fff)]">
          <MayaIcon name="plus" size={15} />
        </span>
        <span className="min-w-0 flex-1">Разделы</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent/80">
          ещё
        </span>
      </Link>
      {visiblePinned.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={close}
          className={linkClass(
            pathname === item.href || pathname.startsWith(`${item.href}/`),
          )}
        >
          <MayaIcon name={item.icon} size={17} />
          <span>{item.label}</span>
        </Link>
      ))}

      {extraDiaries.map((mod) => {
        const href = `/m/${mod.id}`;
        return (
          <Link
            key={mod.id}
            href={href}
            onClick={close}
            className={linkClass(pathname === href)}
          >
            <MayaIcon name={mod.icon} size={17} />
            <span>{mod.shortTitle}</span>
          </Link>
        );
      })}

      <Link
        href="/legal"
        onClick={close}
        className="mt-4 px-2.5 text-[11px] text-muted underline underline-offset-2 hover:text-foreground"
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
