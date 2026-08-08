import { parseHeightCm, parseWeightKg } from "@/lib/growth-norms";
import { MODULE_BY_ID } from "@/lib/modules";
import { findOnThisDay } from "@/lib/on-this-day";
import type {
  ChildProfile,
  CustomModule,
  JournalEntry,
  MemoryItem,
  WardrobeItem,
} from "@/lib/types";

export type FeedItem = {
  id: string;
  kind: "entry" | "insight" | "chat" | "stat" | "memory" | "empty";
  eyebrow: string;
  title: string;
  subtitle?: string;
  body: string;
  badge?: string;
  href?: string;
  tone: "care" | "nudge" | "notice";
};

/** Чтобы формулировки не были одинаковыми каждый раз */
function pick<T>(seed: number, variants: T[]): T {
  const i = Math.abs(seed) % variants.length;
  return variants[i]!;
}

function daySeed(): number {
  const d = new Date();
  return d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate();
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
  return Math.abs(da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24);
}

function absoluteWeights(entries: JournalEntry[]): { date: string; kg: number }[] {
  const out: { date: string; kg: number }[] = [];
  for (const e of entries) {
    const w = parseWeightKg(e.value);
    if (!w || w.delta) continue;
    if (w.kg < 1.5 || w.kg > 200) continue;
    out.push({ date: e.date, kg: w.kg });
  }
  return out;
}

function analyzeGrowth(entries: JournalEntry[], seed: number): FeedItem | null {
  const weights = absoluteWeights(entries);
  const heights = entries
    .map((e) => {
      const h = parseHeightCm(e.value);
      if (!h || h.delta) return null;
      return { date: e.date, cm: h.cm };
    })
    .filter((x): x is { date: string; cm: number } => x != null);

  // Сумма прибавок роста из чата (+1 см, +2 см…)
  const heightDeltas = entries
    .map((e) => {
      const h = parseHeightCm(e.value);
      if (!h || !h.delta) return null;
      return { date: e.date, cm: h.cm };
    })
    .filter((x): x is { date: string; cm: number } => x != null);
  const recentHeightGain = heightDeltas
    .slice(0, 6)
    .reduce((s, x) => s + x.cm, 0);

  if (weights.length >= 2) {
    const newest = weights[0]!;
    const older = weights[Math.min(weights.length - 1, 4)]!;
    const delta = Number((newest.kg - older.kg).toFixed(2));
    const span = Math.max(1, Math.round(daysBetween(newest.date, older.date)));

    if (Math.abs(delta) >= 0.15) {
      const sharp = Math.abs(delta) >= 0.4 && span <= 14;
      if (delta > 0) {
        return {
          id: "analysis-growth-weight-up",
          kind: "insight",
          eyebrow: pick(seed, ["Сводка", "По росту", "Динамика"]),
          title: sharp
            ? pick(seed + 1, [
                "Резкая прибавка",
                "Вес скакнул",
                "Набрал заметно",
              ])
            : pick(seed + 1, ["Прибавка в весе", "Вес растёт", "Набирает"]),
          body: sharp
            ? pick(seed + 2, [
                `За ~${span} дн. +${delta} кг (сейчас ~${newest.kg} кг). Если так и задумывали — ок; если резко — сверьте записи.`,
                `Прибавка +${delta} кг за короткий срок. Иногда это дубль записи — загляните в рост и вес.`,
                `Малыш прибавил ~${delta} кг. Имеет смысл глянуть динамику на графике.`,
              ])
            : pick(seed + 2, [
                `За период ~${span} дн. вес ${older.kg} → ${newest.kg} кг (+${delta}).`,
                `Сейчас ~${newest.kg} кг — плюс ${delta} кг к прошлому замеру.`,
                `Вес подрос на ${delta} кг. Можно сверить с предыдущими точками.`,
              ]),
          href: "/m/growth",
          badge: `+${delta} кг`,
          tone: sharp ? "nudge" : "care",
        };
      }
      return {
        id: "analysis-growth-weight-down",
        kind: "insight",
        eyebrow: pick(seed, ["Сводка", "По росту"]),
        title: pick(seed + 1, ["Вес снизился", "Минус в весе", "Убавил"]),
        body: pick(seed + 2, [
          `За ~${span} дн. ${older.kg} → ${newest.kg} кг (${delta} кг). Если кормите / болеете — держите на радаре.`,
          `Сейчас ~${newest.kg} кг (${delta} кг к прошлому замеру).`,
        ]),
        href: "/m/growth",
        badge: `${delta} кг`,
        tone: "nudge",
      };
    }
  }

  if (heights.length >= 2) {
    const newest = heights[0]!;
    const older = heights[Math.min(heights.length - 1, 4)]!;
    const delta = Number((newest.cm - older.cm).toFixed(1));
    if (Math.abs(delta) >= 0.5) {
      return {
        id: "analysis-growth-height",
        kind: "insight",
        eyebrow: pick(seed, ["Сводка", "Рост", "Динамика"]),
        title:
          delta > 0
            ? pick(seed + 1, ["Вытягивается", "Рост пошёл", "Стал выше"])
            : pick(seed + 1, ["Рост ниже прошлого", "Минус в росте"]),
        body:
          delta > 0
            ? pick(seed + 2, [
                `Рост ~${older.cm} → ${newest.cm} см (+${delta}). Проверьте, не тесна ли одежда.`,
                `Прибавил ~${delta} см. Имеет смысл глянуть гардероб.`,
                `Сейчас ~${newest.cm} см — плюс ${delta} см к прошлому замеру.`,
              ])
            : `Рост ${older.cm} → ${newest.cm} см (${delta}). Сверьте записи — иногда это опечатка.`,
        href: "/m/growth",
        badge: `${delta > 0 ? "+" : ""}${delta} см`,
        tone: "care",
      };
    }
  }

  if (recentHeightGain >= 1) {
    const last = heightDeltas[0]!;
    return {
      id: "analysis-growth-height-delta",
      kind: "insight",
      eyebrow: pick(seed, ["Рост", "Сводка", "Динамика"]),
      title: pick(seed + 1, ["Прибавка в росте", "Вырос", "Стал выше"]),
      body: pick(seed + 2, [
        `В дневнике уже +${Number(recentHeightGain.toFixed(1))} см (последнее: +${last.cm} см). Как с весом — копим динамику.`,
        `Записана прибавка роста: +${last.cm} см. Можно добавить точный рост в см — график станет понятнее.`,
        `Рост отмечается: суммарно ~+${Number(recentHeightGain.toFixed(1))} см по последним записям.`,
      ]),
      href: "/m/growth",
      badge: `+${Number(recentHeightGain.toFixed(1))} см`,
      tone: "care",
    };
  }

  if (heights[0]) {
    return {
      id: "analysis-growth-height-now",
      kind: "stat",
      eyebrow: "Сейчас",
      title: pick(seed, ["Рост на контроле", "Последний рост", "Точка роста"]),
      body: pick(seed + 1, [
        `Последняя запись: ~${heights[0].cm} см. Добавьте ещё замер — появится динамика.`,
        `Сейчас в дневнике ~${heights[0].cm} см.`,
      ]),
      href: "/m/growth",
      badge: `${heights[0].cm} см`,
      tone: "care",
    };
  }

  if (weights[0]) {
    return {
      id: "analysis-growth-now",
      kind: "stat",
      eyebrow: "Сейчас",
      title: pick(seed, ["Вес на контроле", "Последний вес", "Точка веса"]),
      body: pick(seed + 1, [
        `Последняя запись: ~${weights[0].kg} кг. Добавьте ещё замер — появится динамика.`,
        `Сейчас в дневнике ~${weights[0].kg} кг.`,
      ]),
      href: "/m/growth",
      tone: "care",
    };
  }

  return null;
}

function analyzeDiet(
  entries: JournalEntry[],
  planKcal: number | null,
  seed: number,
): FeedItem | null {
  if (!entries.length) return null;

  const byDay = new Map<string, number>();
  for (const e of entries) {
    const fromField = Number(e.fields?.kcal);
    let kcal = Number.isFinite(fromField) && fromField > 0 ? fromField : 0;
    if (!kcal) {
      const m = e.value.match(/(\d+)\s*ккал/i);
      kcal = m ? Number(m[1]) : 0;
    }
    if (kcal <= 0) continue;
    byDay.set(e.date, (byDay.get(e.date) || 0) + kcal);
  }
  if (!byDay.size) return null;

  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const recent = days.slice(0, 7);
  const avg =
    recent.reduce((s, [, k]) => s + k, 0) / Math.max(1, recent.length);

  // «похудели» — если цель ниже нормы и человек в среднем около/ниже цели
  if (planKcal && planKcal > 800 && recent.length >= 2) {
    const underDays = recent.filter(([, k]) => k > 0 && k <= planKcal + 80).length;
    const overDays = recent.filter(([, k]) => k > planKcal + 250).length;
    if (underDays >= Math.ceil(recent.length * 0.6)) {
      return {
        id: "analysis-diet-ontrack",
        kind: "insight",
        eyebrow: pick(seed, ["Диета", "Питание", "По калориям"]),
        title: pick(seed + 1, [
          "Держите темп",
          "В рамках ориентира",
          "Идёте по плану",
        ]),
        body: pick(seed + 2, [
          `В среднем ~${Math.round(avg)} ккал/день при цели ${planKcal}. Так обычно и худеют — мягко, без срывов.`,
          `Чаще попадаете в цель (~${planKcal} ккал). Среднее за дни: ~${Math.round(avg)}.`,
          `Калории под контролем: среднее ~${Math.round(avg)} при ориентире ${planKcal}.`,
        ]),
        href: "/m/diet",
        badge: `~${Math.round(avg)}`,
        tone: "care",
      };
    }
    if (overDays >= 2) {
      return {
        id: "analysis-diet-over",
        kind: "insight",
        eyebrow: pick(seed, ["Диета", "Питание"]),
        title: pick(seed + 1, [
          "Чаще сверх цели",
          "Калории завышены",
          "Ориентир уплывает",
        ]),
        body: pick(seed + 2, [
          `За последние дни среднее ~${Math.round(avg)} ккал при цели ${planKcal}. Можно чуть урезать перекусы — без жёсткости.`,
          `Несколько дней заметно выше ${planKcal} ккал. Взгляните на «Сегодня» в диете.`,
        ]),
        href: "/m/diet",
        badge: `~${Math.round(avg)}`,
        tone: "nudge",
      };
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayK = byDay.get(today);
  if (todayK != null && todayK > 0) {
    return {
      id: "analysis-diet-today",
      kind: "stat",
      eyebrow: "Диета",
      title: pick(seed, ["Сегодня по калориям", "Набрано за день"]),
      body: planKcal
        ? pick(seed + 1, [
            `Уже ~${todayK} ккал из ${planKcal}.`,
            `Сегодня записано ~${todayK} ккал (цель ${planKcal}).`,
          ])
        : `Сегодня в дневнике ~${todayK} ккал.`,
      href: "/m/diet",
      badge: `${todayK}`,
      tone: "care",
    };
  }

  return {
    id: "analysis-diet-active",
    kind: "insight",
    eyebrow: "Диета",
    title: pick(seed, ["Диета ведётся", "Есть записи по питанию"]),
    body: pick(seed + 1, [
      `Уже ${byDay.size} дн. с записями. Среднее ~${Math.round(avg)} ккал — смотрите динамику в разделе.`,
      `Питание отмечается: среднее за дни ~${Math.round(avg)} ккал.`,
    ]),
    href: "/m/diet",
    tone: "care",
  };
}

function analyzeSleep(entries: JournalEntry[], seed: number): FeedItem | null {
  if (entries.length < 3) return null;
  const recent = entries.slice(0, 8);
  const hours = recent
    .map((e) => {
      const range = e.value.match(
        /(\d{1,2})[:.](\d{2})\s*[–\-—]\s*(\d{1,2})[:.](\d{2})/,
      );
      if (range) {
        let a = Number(range[1]) * 60 + Number(range[2]);
        let b = Number(range[3]) * 60 + Number(range[4]);
        if (b < a) b += 24 * 60;
        return (b - a) / 60;
      }
      const h = e.value.match(/(\d+(?:[.,]\d+)?)\s*(ч|час)/i);
      return h ? Number(h[1].replace(",", ".")) : null;
    })
    .filter((n): n is number => n != null && n > 0.2);
  if (hours.length < 3) return null;
  const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
  return {
    id: "analysis-sleep",
    kind: "insight",
    eyebrow: pick(seed, ["Сон", "Режим"]),
    title: pick(seed + 1, ["Как спит", "Сон за дни", "Режим сна"]),
    body: pick(seed + 2, [
      `По последним записям в среднем ~${avg.toFixed(1)} ч. Если ночи рваные — отметьте это в дневнике сна.`,
      `Средняя длительность ~${avg.toFixed(1)} ч по свежим записям.`,
    ]),
    href: "/m/sleep",
    tone: "care",
  };
}

/**
 * Короткая лента-анализ (не история всех записей).
 * Обычно 1–3 карточки, формулировки меняются день ото дня.
 */
export function buildChatFeed(input: {
  profile: ChildProfile;
  journals: Record<string, JournalEntry[]>;
  customModules: CustomModule[];
  wardrobe: WardrobeItem[];
  enabledModules: string[];
  memories: MemoryItem[];
  messages?: unknown;
  dietPlanKcal?: number | null;
}): FeedItem[] {
  const { journals, enabledModules, memories, dietPlanKcal } = input;
  const seed = daySeed();
  const list: FeedItem[] = [];

  if (enabledModules.includes("growth")) {
    const g = analyzeGrowth(journals.growth ?? [], seed);
    if (g) list.push(g);
  }

  if (enabledModules.includes("diet")) {
    const d = analyzeDiet(journals.diet ?? [], dietPlanKcal ?? null, seed + 11);
    if (d) list.push(d);
  }

  if (enabledModules.includes("sleep") && list.length < 3) {
    const s = analyzeSleep(journals.sleep ?? [], seed + 23);
    if (s) list.push(s);
  }

  // один «живой» намёк, если мало данных
  if (list.length === 0) {
    const anyEnabled = enabledModules.find((id) => MODULE_BY_ID[id as keyof typeof MODULE_BY_ID]);
    list.push({
      id: "empty-soft",
      kind: "empty",
      eyebrow: "Лента",
      title: pick(seed, ["Пока мало данных", "Тихо в дневниках", "Ждём записей"]),
      body: pick(seed + 1, [
        "Когда появятся замеры или диета — здесь будет короткий разбор, не вся история подряд.",
        "Напишите Мае факт или отметьте в разделе — сюда попадёт суть, без простыни новостей.",
      ]),
      href: anyEnabled ? `/m/${anyEnabled}` : "/modules",
      tone: "notice",
    });
  }

  if (findOnThisDay(memories) && list.length < 3) {
    list.push({
      id: "on-this-day",
      kind: "memory",
      eyebrow: "Моменты",
      title: pick(seed + 5, ["В этот день", "Кадр из прошлого"]),
      body: "Есть момент с этой же датой — можно заглянуть в воспоминания.",
      href: "/memories",
      tone: "care",
    });
  }

  return list.slice(0, 3);
}
