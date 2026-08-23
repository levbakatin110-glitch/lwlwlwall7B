/** Локальная календарная дата YYYY-MM-DD (без сдвига UTC). */

export function toLocalDateIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localToday(): string {
  return toLocalDateIso(new Date());
}
