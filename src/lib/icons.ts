export const ICON_NAMES = [
  "chat",
  "profile",
  "wardrobe",
  "moments",
  "memory",
  "growth",
  "feeding",
  "formula",
  "solids",
  "outfit",
  "sleep",
  "vaccines",
  "health",
  "diet",
  "water",
  "walk",
  "diaper",
  "notes",
  "spark",
  "sport",
  "work",
  "study",
  "pulse",
  "list",
  "close",
  "edit",
  "plus",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export function isIconName(value: string): value is IconName {
  return (ICON_NAMES as readonly string[]).includes(value);
}

export function normalizeIconName(value?: string | null): IconName {
  if (value && isIconName(value)) return value;
  return "spark";
}
