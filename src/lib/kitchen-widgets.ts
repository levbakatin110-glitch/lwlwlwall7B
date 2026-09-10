import type { IconName } from "@/lib/icons";

export const KITCHEN_WIDGETS = [
  {
    id: "recipes",
    title: "Рецепты",
    icon: "solids" as IconName,
    hash: "widget-recipes",
    extraHashes: [] as string[],
    catalogHref: "/recipes" as string | null,
    catalogLabel: "Все →" as string | null,
  },
  {
    id: "noise",
    title: "Шум для сна",
    icon: "sleep" as IconName,
    hash: "widget-noise",
    extraHashes: ["noise"],
    catalogHref: null,
    catalogLabel: null,
  },
  {
    id: "reminders",
    title: "Напоминания",
    icon: "bell" as IconName,
    hash: "widget-reminders",
    extraHashes: [] as string[],
    catalogHref: "/reminders" as string | null,
    catalogLabel: "Все →" as string | null,
  },
] as const;

export function kitchenSlideFromHash(hash: string): number {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw) return -1;
  return KITCHEN_WIDGETS.findIndex(
    (w) => w.hash === raw || (w.extraHashes as readonly string[]).includes(raw),
  );
}

export function hashWantsKitchen(hash = ""): boolean {
  return kitchenSlideFromHash(hash) >= 0;
}
