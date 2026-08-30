"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { MayaIcon, type IconName } from "@/components/icons/MayaIcon";
import { showPaywallHint } from "@/components/PaywallHint";
import { MODULE_BY_ID, customToDef } from "@/lib/modules";
import { isSubscriptionActive, PAID_ONLY } from "@/lib/subscription";
import { useAppStore } from "@/lib/store";
import type { CustomModule, ModuleId } from "@/lib/types";

/** Порядок «популярных» ярлыков в шапке — только включённые разделы */
const POPULAR_ORDER: ModuleId[] = [
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
  "notes",
];

/** Короткие подписи под иконкой в узкой шапке */
const NAV_LABEL: Partial<Record<ModuleId, string>> = {
  growth: "Рост",
  vaccines: "Прививки",
  sleep: "Сон",
  breastfeeding: "ГВ",
  formula: "Смеси",
  solids: "Прикорм",
  diaper: "Подгуз.",
  water: "Вода",
  walk: "Прогулка",
  health: "Здоровье",
  notes: "Заметки",
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

function buildQuickItems(
  enabled: ModuleId[],
  customModules: CustomModule[],
): QuickItem[] {
  const items: QuickItem[] = [
    { href: "/", label: "Чат", icon: "chat" },
    { href: "/community", label: "Общение", icon: "circle" },
  ];

  for (const id of POPULAR_ORDER) {
    if (!enabled.includes(id)) continue;
    const mod = MODULE_BY_ID[id];
    if (!mod) continue;
    items.push({
      href: `/m/${id}`,
      label: NAV_LABEL[id] ?? shortenLabel(mod.shortTitle),
      icon: mod.icon as IconName,
    });
  }

  for (const c of customModules.slice(0, 4)) {
    const def = customToDef(c);
    items.push({
      href: `/m/${def.id}`,
      label: shortenLabel(def.shortTitle),
      icon: def.icon as IconName,
    });
  }

  items.push({ href: "/wardrobe", label: "Гардероб", icon: "wardrobe" });

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
  const subscription = useAppStore((s) => s.subscription);
  const paywalled = PAID_ONLY && !isSubscriptionActive(subscription);
  const items = buildQuickItems(enabledModules, customModules);

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
    </div>
  );
}
