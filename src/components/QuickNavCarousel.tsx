"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { MayaIcon, type IconName } from "@/components/icons/MayaIcon";
import { showPaywallHint } from "@/components/PaywallHint";
import { MODULE_BY_ID, customToDef } from "@/lib/modules";
import {
  filterModulesForNav,
  hasBornChild,
} from "@/lib/module-audience";
import { isSubscriptionActive, PAID_ONLY } from "@/lib/subscription";
import { useAppStore } from "@/lib/store";
import type { CustomModule, ModuleId } from "@/lib/types";

/** Приоритет в шапке: сначала эти, потом остальные включённые */
const PRIORITY_ORDER: ModuleId[] = [
  "growth",
  "vaccines",
  "sleep",
  "breastfeeding",
  "formula",
  "solids",
  "diaper",
  "water",
  "walk",
  "health",
  "pregnancy",
  "preg_pressure",
  "preg_symptoms",
  "preg_visits",
  "preg_belly",
  "preg_meds",
  "preg_labs",
  "preg_sleep",
  "birth_plan",
  "cycle",
  "diet",
];

/** Короткие подписи под иконкой в узкой шапке */
const NAV_LABEL: Partial<Record<ModuleId, string>> = {
  growth: "Рост малыша",
  vaccines: "Прививки",
  sleep: "Сон",
  breastfeeding: "ГВ",
  formula: "Смеси",
  solids: "Прикорм",
  diaper: "Подгуз.",
  water: "Вода",
  walk: "Прогулка",
  health: "Здоровье",
  pregnancy: "Неделя",
  contractions: "Схватки",
  kicks: "Шевел.",
  preg_pressure: "Давлен.",
  preg_symptoms: "Симптом",
  preg_visits: "Визиты",
  preg_belly: "Живот",
  preg_meds: "Лекар.",
  preg_labs: "Анализы",
  preg_sleep: "Сон м.",
  birth_plan: "Роды",
  cycle: "Цикл",
  diet: "Диета",
};

type QuickItem = {
  href: string;
  label: string;
  icon: IconName;
};

function shortenLabel(raw: string, max = 9): string {
  const t = raw.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function moduleItem(id: ModuleId): QuickItem | null {
  const mod = MODULE_BY_ID[id];
  if (!mod) return null;
  return {
    href: `/m/${id}`,
    label: NAV_LABEL[id] ?? shortenLabel(mod.shortTitle),
    icon: mod.icon as IconName,
  };
}

function buildQuickItems(
  enabled: ModuleId[],
  customModules: CustomModule[],
  hasChild: boolean,
): QuickItem[] {
  const items: QuickItem[] = [
    { href: "/", label: "Чат", icon: "chat" },
    { href: "/community", label: "Общение", icon: "circle" },
  ];

  const placed = new Set<ModuleId>();

  for (const id of PRIORITY_ORDER) {
    if (!enabled.includes(id) || placed.has(id)) continue;
    const item = moduleItem(id);
    if (!item) continue;
    items.push(item);
    placed.add(id);
  }

  for (const id of enabled) {
    if (placed.has(id)) continue;
    const item = moduleItem(id);
    if (!item) continue;
    items.push(item);
    placed.add(id);
  }

  for (const c of customModules) {
    const def = customToDef(c);
    items.push({
      href: `/m/${def.id}`,
      label: shortenLabel(def.shortTitle),
      icon: def.icon as IconName,
    });
  }

  if (hasChild) {
    items.push({ href: "/wardrobe", label: "Одежда", icon: "wardrobe" });
  }

  const seen = new Set<string>();
  return items.filter((it) => {
    if (seen.has(it.href)) return false;
    seen.add(it.href);
    return true;
  });
}

export function QuickNavCarousel({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const enabledModules = useAppStore((s) => s.enabledModules ?? []);
  const customModules = useAppStore((s) => s.customModules ?? []);
  const pregnancy = useAppStore((s) => s.pregnancy);
  const childrenList = useAppStore((s) => s.children ?? []);
  const subscription = useAppStore((s) => s.subscription);
  const paywalled = PAID_ONLY && !isSubscriptionActive(subscription);
  const hasChild = hasBornChild(childrenList);
  const items = buildQuickItems(
    filterModulesForNav(enabledModules, {
      pregnant: Boolean(pregnancy?.active),
      hasChild,
    }),
    customModules,
    hasChild,
  );
  const canScroll = items.length > 4;

  function onNavClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!paywalled) return;
    if (href === "/pricing" || href.startsWith("/pricing/")) return;
    e.preventDefault();
    showPaywallHint("Сначала оформите подписку");
  }

  return (
    <div
      className={`relative min-w-0 flex-1 ${className}`}
      aria-label="Быстрые разделы"
    >
      <div
        className="flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-none scroll-smooth px-0.5 py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={(e) => onNavClick(e, item.href)}
              className={`flex w-[3.35rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl px-0.5 py-0.5 transition ${
                active ? "bg-accent/10" : "hover:bg-accent-soft/50"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                  active
                    ? "bg-accent text-white shadow-sm"
                    : "bg-accent-soft/80 text-foreground ring-1 ring-line"
                }`}
              >
                <MayaIcon name={item.icon} size={16} />
              </span>
              <span
                className={`w-full truncate text-center text-[9px] font-semibold leading-tight tracking-tight ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      {canScroll ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-card to-transparent"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
