import type { ChildProfile, CustomModule, JournalEntry, WardrobeItem } from "./types";

export type Insight = {
  id: string;
  text: string;
  tone: "notice" | "nudge" | "care";
};

function parseHoursFromSleep(value: string): number | null {
  const range = value.match(/(\d{1,2})[:.](\d{2})\s*[–\-—]\s*(\d{1,2})[:.](\d{2})/);
  if (range) {
    let a = Number(range[1]) * 60 + Number(range[2]);
    let b = Number(range[3]) * 60 + Number(range[4]);
    if (b < a) b += 24 * 60;
    return (b - a) / 60;
  }
  const h = value.match(/(\d+(?:[.,]\d+)?)\s*(ч|час)/i);
  if (h) return Number(h[1].replace(",", "."));
  return null;
}

function parseHeightCm(value: string): number | null {
  const m = value.match(/(\d{2,3}(?:[.,]\d+)?)\s*см/i);
  if (m) return Number(m[1].replace(",", "."));
  const bare = value.match(/^(\d{2,3}(?:[.,]\d+)?)$/);
  if (bare) {
    const n = Number(bare[1].replace(",", "."));
    if (n >= 40 && n <= 200) return n;
  }
  return null;
}

function daysAgo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return Infinity;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
}

export function buildInsights(input: {
  profile: ChildProfile;
  journals: Record<string, JournalEntry[]>;
  customModules: CustomModule[];
  wardrobe: WardrobeItem[];
  enabledModules: string[];
}): Insight[] {
  const out: Insight[] = [];
  const { profile, journals, customModules, wardrobe, enabledModules } = input;

  // Сон: сравнение последних 14 дней vs предыдущие 14
  if (enabledModules.includes("sleep")) {
    const sleep = journals.sleep ?? [];
    const recent = sleep.filter((e) => daysAgo(e.date) <= 14);
    const prev = sleep.filter((e) => daysAgo(e.date) > 14 && daysAgo(e.date) <= 28);
    const avg = (list: JournalEntry[]) => {
      const vals = list
        .map((e) => parseHoursFromSleep(e.value))
        .filter((n): n is number => n != null);
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    const a = avg(recent);
    const b = avg(prev);
    if (a != null && b != null && recent.length >= 3 && prev.length >= 3) {
      const diffMin = Math.round((a - b) * 60);
      if (Math.abs(diffMin) >= 25) {
        out.push({
          id: "sleep-trend",
          tone: "notice",
          text:
            diffMin < 0
              ? `За последние две недели сон в среднем короче примерно на ${Math.abs(diffMin)} мин. Имеет смысл глянуть, не сдвинулся ли дневной/вечерний режим.`
              : `За последние две недели сон в среднем длиннее примерно на ${diffMin} мин — хороший знак, если так и задумывали.`,
        });
      }
    }
  }

  // Рост / вес + гардероб
  if (enabledModules.includes("growth")) {
    const growth = journals.growth ?? [];
    const heights = growth
      .map((e) => ({ date: e.date, h: parseHeightCm(e.value) }))
      .filter((x): x is { date: string; h: number } => x.h != null)
      .slice(0, 6);
    if (heights.length >= 2) {
      const newest = heights[0];
      const older = heights[heights.length - 1];
      const delta = newest.h - older.h;
      if (delta >= 2) {
        out.push({
          id: "growth-up",
          tone: "care",
          text: `Рост вырос примерно на ${delta.toFixed(1)} см (${older.h} → ${newest.h}). Имеет смысл проверить, не стала ли тесной одежда из гардероба.`,
        });
      }
      if (wardrobe.length > 0 && newest.h >= 80) {
        out.push({
          id: "wardrobe-size",
          tone: "nudge",
          text: `По текущему росту (~${newest.h} см) скоро может понадобиться одежда следующего размера — загляните в гардероб.`,
        });
      }
    }

    // Недавние ±кг из чата/дневника
    const weightDeltas = growth
      .slice(0, 5)
      .map((e) => {
        const m = e.value.trim().match(/^([+-]\d+(?:[.,]\d+)?)\s*(кг|г|грамм)/i);
        if (!m) return null;
        let n = Number(m[1].replace(",", "."));
        if (/^г/i.test(m[2]) || /грамм/i.test(m[2])) n = n / 1000;
        return { date: e.date, kg: n, raw: e.value };
      })
      .filter((x): x is { date: string; kg: number; raw: string } => x != null);
    if (weightDeltas.length) {
      const last = weightDeltas[0];
      const sum = weightDeltas.reduce((a, b) => a + b.kg, 0);
      if (last.kg < 0) {
        out.push({
          id: "weight-drop",
          tone: "notice",
          text:
            weightDeltas.length > 1 && sum < 0
              ? `За последние записи вес суммарно −${Math.abs(Number(sum.toFixed(2)))} кг (последнее: ${last.raw}). Если тренд держится — стоит уточнить у педиатра.`
              : `В дневнике: ${last.raw}. Если это не разовая погрешность весов — лучше свериться с педиатром.`,
        });
      } else if (last.kg > 0) {
        out.push({
          id: "weight-up",
          tone: "care",
          text: `В дневнике прибавка: ${last.raw}. Хороший повод глянуть динамику в разделе «Рост и вес».`,
        });
      }
    }
  }

  // Свои «памяти»: давно пишут — предложить посмотреть прогресс
  for (const mod of customModules) {
    const entries = journals[mod.id] ?? [];
    if (entries.length < 4) continue;
    const oldest = entries[entries.length - 1];
    if (daysAgo(oldest.date) >= 21) {
      out.push({
        id: `progress-${mod.id}`,
        tone: "nudge",
        text: `Уже ${entries.length} записей в «${mod.title}». Можете спросить в чате: «Как изменились результаты?» — я сверю динамику.`,
      });
    }
  }

  // Мягкий онбординг
  if (profile.city?.trim() && wardrobe.length === 0) {
    out.push({
      id: "wardrobe-hint",
      tone: "nudge",
      text: "Загрузите фото одежды в гардероб — и на вопрос «во что одеть малыша?» я отвечу из ваших вещей, а не общими словами.",
    });
  } else if (
    profile.city?.trim() &&
    customModules.length === 0 &&
    (journals.sleep?.length ?? 0) === 0
  ) {
    out.push({
      id: "memory-hint",
      tone: "care",
      text: "Напишите в чат про сон или кормление — Мая предложит дневник и будет учитывать это в ответах.",
    });
  }

  // Уникальность + лимит
  const seen = new Set<string>();
  return out
    .filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    })
    .slice(0, 5);
}
