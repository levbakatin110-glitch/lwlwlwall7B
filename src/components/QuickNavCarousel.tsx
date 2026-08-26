"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MayaIcon, type IconName } from "@/components/icons/MayaIcon";
import { MODULE_BY_ID, customToDef } from "@/lib/modules";
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

type QuickItem = {
  href: string;
  label: string;
  icon: IconName;
};

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
      label: mod.shortTitle,
      icon: mod.icon as IconName,
    });
  }

  // Свои дневники — тоже в карусель (короткие ярлыки)
  for (const c of customModules.slice(0, 4)) {
    const def = customToDef(c);
    items.push({
      href: `/m/${def.id}`,
      label: def.shortTitle,
      icon: def.icon as IconName,
    });
  }

  items.push(
    { href: "/wardrobe", label: "Гардероб", icon: "wardrobe" },
    { href: "/memories", label: "Моменты", icon: "moments" },
  );

  // без дублей по href
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
  const items = buildQuickItems(enabledModules, customModules);

  return (
    <div
      className={`relative min-w-0 flex-1 ${className}`}
      aria-label="Быстрые разделы"
    >
      <div
        className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-none scroll-smooth px-0.5 py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              className={`flex h-9 w-9 shrink-0 snap-start items-center justify-center rounded-xl transition ${
                active
                  ? "bg-accent text-white shadow-sm"
                  : "bg-accent-soft/80 text-foreground ring-1 ring-line hover:bg-accent-soft"
              }`}
            >
              <MayaIcon name={item.icon} size={17} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
