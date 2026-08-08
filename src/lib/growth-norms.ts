/** Грубая оценка динамики роста/веса. Не замена педиатру / центильным таблицам. */

export type GrowthSignal = "ok" | "watch" | "hot" | "unknown";

export type GrowthNeed = "birthDate" | "height" | "weight" | "absolute";

export type GrowthAssessment = {
  signal: GrowthSignal;
  title: string;
  detail: string;
  /** Чего не хватает, чтобы сказать «нормально / не нормально» */
  needs?: GrowthNeed[];
};

export function ageMonths(birthDate: string | undefined | null): number | null {
  if (!birthDate?.trim()) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  const months =
    (now.getFullYear() - b.getFullYear()) * 12 +
    (now.getMonth() - b.getMonth()) +
    (now.getDate() < b.getDate() ? -1 : 0);
  return Math.max(0, months);
}

export function parseWeightKg(raw: string): { kg: number; delta: boolean } | null {
  const t = raw.trim().toLowerCase();
  const m = t.match(/([+-]?\d+(?:[.,]\d+)?)\s*кг/);
  if (!m) return null;
  const kg = Number(m[1].replace(",", "."));
  if (!Number.isFinite(kg)) return null;
  const delta =
    t.includes("+") ||
    t.includes("-") ||
    /набрал|прибав|убавил|потеря/i.test(t) ||
    m[1].startsWith("+") ||
    m[1].startsWith("-");
  return { kg, delta: delta || Math.abs(kg) < 15 };
}

export function parseHeightCm(raw: string): { cm: number; delta: boolean } | null {
  const t = raw.trim().toLowerCase();
  const m = t.match(/([+-]?\d+(?:[.,]\d+)?)\s*см/);
  if (m) {
    const cm = Number(m[1].replace(",", "."));
    if (!Number.isFinite(cm)) return null;
    const delta =
      m[1].startsWith("+") ||
      m[1].startsWith("-") ||
      /вырос|прибав|см за/i.test(t);
    return { cm, delta: delta || cm < 20 };
  }
  const bare = t.match(/^(\d{2,3}(?:[.,]\d+)?)$/);
  if (bare) {
    const cm = Number(bare[1].replace(",", "."));
    if (cm >= 40 && cm <= 130) return { cm, delta: false };
  }
  return null;
}

/** Ожидаемая прибавка веса кг/мес по возрасту (очень приблизительно) */
function expectedWeightGainKgPerMonth(months: number): { min: number; max: number } {
  if (months < 3) return { min: 0.6, max: 1.0 };
  if (months < 6) return { min: 0.4, max: 0.7 };
  if (months < 12) return { min: 0.2, max: 0.5 };
  if (months < 24) return { min: 0.1, max: 0.3 };
  return { min: 0.05, max: 0.25 };
}

function expectedHeightGainCmPerMonth(months: number): { min: number; max: number } {
  if (months < 6) return { min: 1.5, max: 3.5 };
  if (months < 12) return { min: 1.0, max: 2.5 };
  if (months < 24) return { min: 0.6, max: 1.5 };
  return { min: 0.4, max: 1.0 };
}

export type GrowthPoint = {
  at: string; // ISO date or datetime
  label: string;
  value: string;
  weight?: { kg: number; delta: boolean };
  height?: { cm: number; delta: boolean };
};

export function assessGrowth(opts: {
  birthDate?: string | null;
  points: GrowthPoint[];
}): GrowthAssessment {
  const months = ageMonths(opts.birthDate);
  const points = [...opts.points].sort((a, b) => a.at.localeCompare(b.at));

  const absWeights = points.filter((p) => p.weight && !p.weight.delta);
  const absHeights = points.filter((p) => p.height && !p.height.delta);
  const hasAbsWeight = absWeights.length > 0;
  const hasAbsHeight = absHeights.length > 0;
  const onlyDeltas =
    points.some((p) => p.weight?.delta || p.height?.delta) &&
    !hasAbsWeight &&
    !hasAbsHeight;

  if (points.length === 0) {
    const needs: GrowthNeed[] = [];
    if (months == null) needs.push("birthDate");
    needs.push("height", "weight");
    return {
      signal: "unknown",
      title: "Нужны данные малыша",
      detail:
        "Чтобы сказать, нормально ли растёт ребёнок, укажите дату рождения и текущие рост (см) и вес (кг) — не только «+1 кг».",
      needs,
    };
  }

  // Сумма прибавок веса за ~30 дней
  const monthAgo = Date.now() - 35 * 24 * 60 * 60 * 1000;
  const recentDeltas = points.filter((p) => {
    const t = new Date(p.at).getTime();
    return Number.isFinite(t) && t >= monthAgo && p.weight?.delta;
  });
  const gainKg = recentDeltas.reduce((s, p) => s + (p.weight?.kg ?? 0), 0);

  // Сначала просим недостающее — иначе оценка бессмысленна
  const missing: GrowthNeed[] = [];
  if (months == null) missing.push("birthDate");
  if (!hasAbsHeight) missing.push("height");
  if (!hasAbsWeight && onlyDeltas) missing.push("weight");
  if (!hasAbsWeight && !hasAbsHeight && onlyDeltas) missing.push("absolute");

  if (missing.length > 0 && (months == null || onlyDeltas || !hasAbsHeight)) {
    const asks: string[] = [];
    if (missing.includes("birthDate")) asks.push("дату рождения в профиле «Малыш»");
    if (missing.includes("height")) asks.push("текущий рост в см (например: 68 см)");
    if (missing.includes("weight") || missing.includes("absolute")) {
      asks.push("текущий вес в кг (например: 8.2 кг), а не только прибавку");
    }
    return {
      signal: "unknown",
      title: "Укажите данные — тогда скажу про норму",
      detail: `Пока вижу только обрывки. Нужно: ${asks.join("; ")}. После этого смогу сказать, спокойно ли идёт рост.`,
      needs: missing,
    };
  }

  if (months == null) {
    if (recentDeltas.length >= 1) {
      if (Math.abs(gainKg) >= 2.5 && recentDeltas.length <= 3) {
        return {
          signal: "hot",
          title: "Резкие скачки веса",
          detail: `За короткое время в дневнике ≈ ${gainKg > 0 ? "+" : ""}${gainKg.toFixed(1)} кг. Уточните у педиатра, если это не опечатка.`,
          needs: ["birthDate"],
        };
      }
    }
    return {
      signal: "unknown",
      title: "Нужна дата рождения",
      detail:
        "Укажите дату рождения в профиле «Малыш» — сверю прибавки с типичными ориентирами для возраста.",
      needs: ["birthDate"],
    };
  }

  const wExp = expectedWeightGainKgPerMonth(months);
  const hExp = expectedHeightGainCmPerMonth(months);

  if (recentDeltas.length >= 1) {
    // Если несколько прибавок в один день на 3+ кг — «странно»
    const byDay = new Map<string, number>();
    for (const p of recentDeltas) {
      const day = p.at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + (p.weight?.kg ?? 0));
    }
    const maxDay = Math.max(...byDay.values());
    if (maxDay >= 2) {
      return {
        signal: "hot",
        title: "Слишком большая прибавка за день",
        detail: `В дневнике за один день набралось ≈ ${maxDay.toFixed(1)} кг. Так обычно не бывает — проверьте, не продублировались ли записи из чата.`,
      };
    }

    const monthly = gainKg; // приближённо за окно
    if (monthly > wExp.max * 1.8) {
      return {
        signal: "watch",
        title: "Прибавка выше обычного",
        detail: `За последнее время ≈ +${monthly.toFixed(1)} кг. Для ~${months} мес. ориентир примерно ${wExp.min}…${wExp.max} кг/мес. Это не диагноз — при сомнениях к педиатру.`,
        needs: hasAbsHeight ? undefined : ["height"],
      };
    }
    if (monthly < 0 && Math.abs(monthly) > 0.3) {
      return {
        signal: "watch",
        title: "Вес ушёл вниз",
        detail: `Записи показывают около ${monthly.toFixed(1)} кг. Имеет смысл перепроверить цифры и при необходимости спросить педиатра.`,
      };
    }
    if (monthly >= wExp.min * 0.5 && monthly <= wExp.max * 1.5) {
      return {
        signal: "ok",
        title: "Прибавка выглядит спокойно",
        detail: `Около ${monthly >= 0 ? "+" : ""}${monthly.toFixed(1)} кг за последнее время — в пределах грубого ориентира для ~${months} мес. (${wExp.min}…${wExp.max} кг/мес). Не замена осмотру.`,
        needs: hasAbsHeight ? undefined : ["height"],
      };
    }
  }

  if (absWeights.length >= 2) {
    const a = absWeights[absWeights.length - 2]!.weight!.kg;
    const b = absWeights[absWeights.length - 1]!.weight!.kg;
    const d = b - a;
    if (d > wExp.max * 2) {
      return {
        signal: "watch",
        title: "Скачок веса",
        detail: `С ${a} до ${b} кг. Для возраста ~${months} мес. типичнее ${wExp.min}…${wExp.max} кг/мес.`,
        needs: hasAbsHeight ? undefined : ["height"],
      };
    }
    if (d >= 0) {
      return {
        signal: "ok",
        title: "Вес растёт ровно",
        detail: `Сейчас ${b} кг (было ${a} кг). Ориентир прибавки ≈ ${wExp.min}…${wExp.max} кг/мес в ~${months} мес.`,
        needs: hasAbsHeight ? undefined : ["height"],
      };
    }
  }

  if (absHeights.length >= 2) {
    const a = absHeights[absHeights.length - 2]!.height!.cm;
    const b = absHeights[absHeights.length - 1]!.height!.cm;
    const d = b - a;
    if (d > hExp.max * 2) {
      return {
        signal: "watch",
        title: "Рост скакнул резко",
        detail: `${a} → ${b} см. Ориентир ≈ ${hExp.min}…${hExp.max} см/мес в ~${months} мес.`,
      };
    }
    if (d >= 0) {
      return {
        signal: "ok",
        title: "Рост идёт спокойно",
        detail: `Сейчас ${b} см. Ориентир прибавки ≈ ${hExp.min}…${hExp.max} см/мес.`,
        needs: hasAbsWeight ? undefined : ["weight"],
      };
    }
  }

  if (absHeights.length === 1 && !hasAbsWeight) {
    return {
      signal: "unknown",
      title: "Есть рост — нужен вес",
      detail: `Рост ${absHeights[0]!.height!.cm} см записан. Добавьте ещё текущий вес в кг — тогда сверю оба показателя.`,
      needs: ["weight"],
    };
  }

  if (absWeights.length === 1 && !hasAbsHeight) {
    return {
      signal: "unknown",
      title: "Есть вес — нужен рост",
      detail: `Вес ${absWeights[0]!.weight!.kg} кг записан. Добавьте рост в см (например: 68 см) — без роста полную картину не собрать.`,
      needs: ["height"],
    };
  }

  return {
    signal: "unknown",
    title: "Мало точек для оценки",
    detail:
      "Добавьте рост в см и вес в кг с датой (лучше два измерения с разницей) — индикатор станет понятнее.",
    needs: [
      ...(hasAbsHeight ? [] : (["height"] as GrowthNeed[])),
      ...(hasAbsWeight ? [] : (["weight"] as GrowthNeed[])),
    ],
  };
}

export function buildSeries(
  points: GrowthPoint[],
  metric: "weight" | "height",
): { at: string; y: number; label: string }[] {
  const sorted = [...points].sort((a, b) => a.at.localeCompare(b.at));
  const out: { at: string; y: number; label: string }[] = [];
  let cursor: number | null = null;

  for (const p of sorted) {
    if (metric === "weight" && p.weight) {
      if (p.weight.delta) {
        if (cursor == null) cursor = 0;
        cursor += p.weight.kg;
        out.push({ at: p.at, y: cursor, label: p.value });
      } else {
        cursor = p.weight.kg;
        out.push({ at: p.at, y: cursor, label: p.value });
      }
    }
    if (metric === "height" && p.height) {
      if (p.height.delta) {
        if (cursor == null) cursor = 0;
        cursor += p.height.cm;
        out.push({ at: p.at, y: cursor, label: p.value });
      } else {
        cursor = p.height.cm;
        out.push({ at: p.at, y: cursor, label: p.value });
      }
    }
  }
  return out;
}
