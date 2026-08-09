"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { MayaIcon, type IconName } from "@/components/icons/MayaIcon";
import { SidebarHeader } from "@/components/SidebarHeader";
import { SketchCorner, SketchSprig } from "@/components/illustrations/MayaSketch";
import { childDisplayName } from "@/lib/children";
import { MODULE_BY_ID, customToDef } from "@/lib/modules";
import { useAppStore } from "@/lib/store";
import type { ModuleId } from "@/lib/types";

const CORE: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Чат с Маей", icon: "chat" },
  { href: "/summary", label: "Итоги дня", icon: "list" },
  { href: "/profile", label: "Малыши", icon: "profile" },
  { href: "/modules", label: "Разделы", icon: "plus" },
];

const PINNED_DIARIES: {
  href: string;
  label: string;
  icon: IconName;
  moduleId?: ModuleId;
}[] = [
  { href: "/m/growth", label: "Рост и вес", icon: "growth", moduleId: "growth" },
  { href: "/m/breastfeeding", label: "ГВ · таймер", icon: "feeding", moduleId: "breastfeeding" },
  { href: "/m/formula", label: "Смеси", icon: "formula", moduleId: "formula" },
  { href: "/m/sleep", label: "Сон", icon: "sleep", moduleId: "sleep" },
  { href: "/m/diet", label: "Диета", icon: "diet", moduleId: "diet" },
  { href: "/memories", label: "Моменты", icon: "moments" },
  { href: "/wardrobe", label: "Гардероб", icon: "wardrobe" },
];

export function Sidebar({
  mobileOpen = false,
  onMobileOpenChange,
}: {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const enabledModules = useAppStore((s) => s.enabledModules);
  const customModules = useAppStore((s) => s.customModules);
  const childrenList = useAppStore((s) => s.children);
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

  const extraDiaries = [
    ...enabledModules
      .filter((id) => !pinnedIds.has(id))
      .map((id) => MODULE_BY_ID[id]),
    ...customModules.map(customToDef),
  ];

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium tracking-tight transition ${
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
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
      {childSwitcher}
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
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
          <MayaIcon name={item.icon} size={18} />
          <span>{item.label}</span>
        </Link>
      ))}

      <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        {childDisplayName(profile)}
      </p>
      {PINNED_DIARIES.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={close}
          className={linkClass(
            pathname === item.href || pathname.startsWith(`${item.href}/`),
          )}
        >
          <MayaIcon name={item.icon} size={18} />
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
            <MayaIcon name={mod.icon} size={18} />
            <span>{mod.shortTitle}</span>
          </Link>
        );
      })}
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
          className="absolute left-0 top-0 flex h-full w-[min(82%,20rem)] flex-col bg-card shadow-2xl ring-1 ring-line"
          style={{ animation: "maya-drawer-in 0.28s ease-out both" }}
        >
          <div className="border-b border-line px-4 py-4">
            {brandMobile}
          </div>
          {nav}
        </aside>
      </div>,
      document.body,
    );

  return (
    <>
      <aside className="hidden min-h-screen w-[17.5rem] shrink-0 flex-col border-r border-line bg-sidebar/95 backdrop-blur-xl md:flex">
        <div className="border-b border-line px-4 py-4">{brand}</div>
        {nav}
      </aside>
      {mobileDrawer}
    </>
  );
}
