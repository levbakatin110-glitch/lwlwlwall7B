/**
 * Ориентиры по стандартам роста ВОЗ (Child Growth Standards) для 0–24 мес.
 * Упрощённые P3 / P15 / P50 / P85 / P97 — не замена педиатру и полным центильным таблицам.
 */

import type { Sex } from "@/lib/types";

export type WhoBand = {
  /** возраст в полных месяцах */
  m: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
};

export type WhoMetric = "weight" | "length";

/** Вес-для-возраста, мальчики, кг */
const WEIGHT_BOY: WhoBand[] = [
  { m: 0, p3: 2.5, p15: 2.9, p50: 3.3, p85: 3.9, p97: 4.4 },
  { m: 1, p3: 3.4, p15: 3.9, p50: 4.5, p85: 5.1, p97: 5.8 },
  { m: 2, p3: 4.3, p15: 4.9, p50: 5.6, p85: 6.3, p97: 7.1 },
  { m: 3, p3: 5.0, p15: 5.7, p50: 6.4, p85: 7.2, p97: 8.0 },
  { m: 4, p3: 5.6, p15: 6.2, p50: 7.0, p85: 7.8, p97: 8.7 },
  { m: 5, p3: 6.0, p15: 6.7, p50: 7.5, p85: 8.4, p97: 9.3 },
  { m: 6, p3: 6.4, p15: 7.1, p50: 7.9, p85: 8.8, p97: 9.8 },
  { m: 7, p3: 6.7, p15: 7.4, p50: 8.3, p85: 9.2, p97: 10.3 },
  { m: 8, p3: 6.9, p15: 7.7, p50: 8.6, p85: 9.6, p97: 10.7 },
  { m: 9, p3: 7.1, p15: 8.0, p50: 8.9, p85: 9.9, p97: 11.0 },
  { m: 10, p3: 7.4, p15: 8.2, p50: 9.2, p85: 10.2, p97: 11.4 },
  { m: 11, p3: 7.6, p15: 8.4, p50: 9.4, p85: 10.5, p97: 11.7 },
  { m: 12, p3: 7.7, p15: 8.6, p50: 9.6, p85: 10.8, p97: 12.0 },
  { m: 15, p3: 8.3, p15: 9.2, p50: 10.3, p85: 11.5, p97: 12.8 },
  { m: 18, p3: 8.8, p15: 9.8, p50: 10.9, p85: 12.2, p97: 13.7 },
  { m: 21, p3: 9.2, p15: 10.3, p50: 11.5, p85: 12.9, p97: 14.5 },
  { m: 24, p3: 9.7, p15: 10.8, p50: 12.2, p85: 13.6, p97: 15.3 },
];

/** Вес-для-возраста, девочки, кг */
const WEIGHT_GIRL: WhoBand[] = [
  { m: 0, p3: 2.4, p15: 2.8, p50: 3.2, p85: 3.7, p97: 4.2 },
  { m: 1, p3: 3.2, p15: 3.6, p50: 4.2, p85: 4.8, p97: 5.5 },
  { m: 2, p3: 3.9, p15: 4.5, p50: 5.1, p85: 5.8, p97: 6.6 },
  { m: 3, p3: 4.5, p15: 5.2, p50: 5.8, p85: 6.6, p97: 7.5 },
  { m: 4, p3: 5.0, p15: 5.7, p50: 6.4, p85: 7.3, p97: 8.2 },
  { m: 5, p3: 5.4, p15: 6.1, p50: 6.9, p85: 7.8, p97: 8.8 },
  { m: 6, p3: 5.7, p15: 6.5, p50: 7.3, p85: 8.2, p97: 9.3 },
  { m: 7, p3: 6.0, p15: 6.8, p50: 7.6, p85: 8.6, p97: 9.8 },
  { m: 8, p3: 6.3, p15: 7.0, p50: 7.9, p85: 9.0, p97: 10.2 },
  { m: 9, p3: 6.5, p15: 7.3, p50: 8.2, p85: 9.3, p97: 10.5 },
  { m: 10, p3: 6.7, p15: 7.5, p50: 8.5, p85: 9.6, p97: 10.9 },
  { m: 11, p3: 6.9, p15: 7.7, p50: 8.7, p85: 9.9, p97: 11.2 },
  { m: 12, p3: 7.0, p15: 7.9, p50: 8.9, p85: 10.1, p97: 11.5 },
  { m: 15, p3: 7.6, p15: 8.6, p50: 9.6, p85: 10.9, p97: 12.4 },
  { m: 18, p3: 8.1, p15: 9.1, p50: 10.2, p85: 11.6, p97: 13.2 },
  { m: 21, p3: 8.6, p15: 9.6, p50: 10.9, p85: 12.3, p97: 14.0 },
  { m: 24, p3: 9.0, p15: 10.2, p50: 11.5, p85: 13.0, p97: 14.8 },
];

/** Длина/рост-для-возраста, мальчики, см */
const LENGTH_BOY: WhoBand[] = [
  { m: 0, p3: 46.1, p15: 48.0, p50: 49.9, p85: 51.8, p97: 53.7 },
  { m: 1, p3: 50.8, p15: 52.8, p50: 54.7, p85: 56.7, p97: 58.6 },
  { m: 2, p3: 54.4, p15: 56.4, p50: 58.4, p85: 60.4, p97: 62.4 },
  { m: 3, p3: 57.3, p15: 59.4, p50: 61.4, p85: 63.5, p97: 65.5 },
  { m: 4, p3: 59.7, p15: 61.8, p50: 63.9, p85: 66.0, p97: 68.0 },
  { m: 5, p3: 61.7, p15: 63.8, p50: 65.9, p85: 68.0, p97: 70.1 },
  { m: 6, p3: 63.3, p15: 65.5, p50: 67.6, p85: 69.8, p97: 71.9 },
  { m: 7, p3: 64.8, p15: 67.0, p50: 69.2, p85: 71.3, p97: 73.5 },
  { m: 8, p3: 66.2, p15: 68.4, p50: 70.6, p85: 72.8, p97: 75.0 },
  { m: 9, p3: 67.5, p15: 69.7, p50: 72.0, p85: 74.2, p97: 76.5 },
  { m: 10, p3: 68.7, p15: 71.0, p50: 73.3, p85: 75.6, p97: 77.9 },
  { m: 11, p3: 69.9, p15: 72.2, p50: 74.5, p85: 76.9, p97: 79.2 },
  { m: 12, p3: 71.0, p15: 73.4, p50: 75.7, p85: 78.1, p97: 80.5 },
  { m: 15, p3: 74.1, p15: 76.6, p50: 79.1, p85: 81.7, p97: 84.2 },
  { m: 18, p3: 76.9, p15: 79.6, p50: 82.3, p85: 85.0, p97: 87.7 },
  { m: 21, p3: 79.4, p15: 82.3, p50: 85.1, p85: 88.0, p97: 90.9 },
  { m: 24, p3: 81.7, p15: 84.8, p50: 87.8, p85: 90.9, p97: 94.0 },
];

/** Длина/рост-для-возраста, девочки, см */
const LENGTH_GIRL: WhoBand[] = [
  { m: 0, p3: 45.4, p15: 47.3, p50: 49.1, p85: 51.0, p97: 52.9 },
  { m: 1, p3: 49.8, p15: 51.7, p50: 53.7, p85: 55.6, p97: 57.6 },
  { m: 2, p3: 53.0, p15: 55.0, p50: 57.1, p85: 59.1, p97: 61.1 },
  { m: 3, p3: 55.6, p15: 57.7, p50: 59.8, p85: 61.9, p97: 64.0 },
  { m: 4, p3: 57.8, p15: 59.9, p50: 62.1, p85: 64.3, p97: 66.4 },
  { m: 5, p3: 59.6, p15: 61.8, p50: 64.0, p85: 66.2, p97: 68.5 },
  { m: 6, p3: 61.2, p15: 63.5, p50: 65.7, p85: 68.0, p97: 70.3 },
  { m: 7, p3: 62.7, p15: 65.0, p50: 67.3, p85: 69.6, p97: 71.9 },
  { m: 8, p3: 64.0, p15: 66.4, p50: 68.7, p85: 71.1, p97: 73.5 },
  { m: 9, p3: 65.3, p15: 67.7, p50: 70.1, p85: 72.6, p97: 75.0 },
  { m: 10, p3: 66.5, p15: 69.0, p50: 71.5, p85: 73.9, p97: 76.4 },
  { m: 11, p3: 67.7, p15: 70.3, p50: 72.8, p85: 75.3, p97: 77.8 },
  { m: 12, p3: 68.9, p15: 71.4, p50: 74.0, p85: 76.6, p97: 79.2 },
  { m: 15, p3: 72.0, p15: 74.8, p50: 77.5, p85: 80.2, p97: 83.0 },
  { m: 18, p3: 74.9, p15: 77.8, p50: 80.7, p85: 83.6, p97: 86.5 },
  { m: 21, p3: 77.5, p15: 80.6, p50: 83.7, p85: 86.7, p97: 89.8 },
  { m: 24, p3: 80.0, p15: 83.2, p50: 86.4, p85: 89.6, p97: 92.9 },
];

function tableFor(sex: Sex, metric: WhoMetric): WhoBand[] {
  const girl = sex === "girl";
  if (metric === "weight") return girl ? WEIGHT_GIRL : WEIGHT_BOY;
  return girl ? LENGTH_GIRL : LENGTH_BOY;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function interpolateBand(table: WhoBand[], months: number): WhoBand | null {
  if (!Number.isFinite(months) || months < 0) return null;
  const m = Math.min(24, months);
  if (m <= table[0]!.m) return table[0]!;
  const last = table[table.length - 1]!;
  if (m >= last.m) return last;

  let i = 0;
  while (i < table.length - 1 && table[i + 1]!.m < m) i += 1;
  const a = table[i]!;
  const b = table[i + 1]!;
  const t = (m - a.m) / (b.m - a.m || 1);
  return {
    m,
    p3: lerp(a.p3, b.p3, t),
    p15: lerp(a.p15, b.p15, t),
    p50: lerp(a.p50, b.p50, t),
    p85: lerp(a.p85, b.p85, t),
    p97: lerp(a.p97, b.p97, t),
  };
}

export function whoBands(sex: Sex, metric: WhoMetric): WhoBand[] {
  return tableFor(sex === "unknown" ? "boy" : sex, metric);
}

export function whoAtAge(
  sex: Sex,
  metric: WhoMetric,
  months: number,
): WhoBand | null {
  return interpolateBand(whoBands(sex, metric), months);
}

export type WhoPercentileHint = {
  label: string;
  detail: string;
  /** грубо: ниже P3 / около P50 / выше P97 */
  zone: "low" | "mid" | "high" | "unknown";
};

export function estimateWhoPercentile(opts: {
  sex: Sex;
  metric: WhoMetric;
  months: number | null;
  value: number;
}): WhoPercentileHint {
  if (opts.months == null || !Number.isFinite(opts.value)) {
    return {
      label: "Нужен возраст",
      detail: "Укажите дату рождения — сверю с ориентирами ВОЗ.",
      zone: "unknown",
    };
  }
  if (opts.months > 24) {
    return {
      label: "После 2 лет",
      detail:
        "Встроенные кривые ВОЗ здесь до 24 месяцев. Дальше ориентируйтесь у педиатра.",
      zone: "unknown",
    };
  }

  const band = whoAtAge(opts.sex, opts.metric, opts.months);
  if (!band) {
    return { label: "Нет данных", detail: "", zone: "unknown" };
  }

  const unit = opts.metric === "weight" ? "кг" : "см";
  const v = opts.value;

  let label: string;
  let zone: WhoPercentileHint["zone"] = "mid";
  if (v < band.p3) {
    label = "ниже 3-го центиля";
    zone = "low";
  } else if (v < band.p15) {
    label = "около 3–15 центиля";
    zone = "low";
  } else if (v < band.p50) {
    label = "около 15–50 центиля";
  } else if (v < band.p85) {
    label = "около 50–85 центиля";
  } else if (v < band.p97) {
    label = "около 85–97 центиля";
    zone = "high";
  } else {
    label = "выше 97-го центиля";
    zone = "high";
  }

  return {
    label,
    detail: `Медиана ВОЗ ≈ ${band.p50.toFixed(1)} ${unit} в ${Math.round(opts.months)} мес. (P3…P97: ${band.p3.toFixed(1)}…${band.p97.toFixed(1)}). Ориентир, не диагноз.`,
    zone,
  };
}

/** Возраст в месяцах на дату замера (дробный) */
export function ageMonthsAt(
  birthDate: string | undefined | null,
  atIso: string,
): number | null {
  if (!birthDate?.trim()) return null;
  const b = new Date(birthDate);
  const at = new Date(atIso.slice(0, 10));
  if (Number.isNaN(b.getTime()) || Number.isNaN(at.getTime())) return null;
  const months =
    (at.getFullYear() - b.getFullYear()) * 12 +
    (at.getMonth() - b.getMonth()) +
    (at.getDate() - b.getDate()) / 30.4;
  return Math.max(0, months);
}
