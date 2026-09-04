/** Зачем ведут дневник: ритм малыша, а не «ещё одна запись». Не диагноз. */

import { ageMonths } from "./growth-norms";
import { toLocalDateIso } from "./local-date";
import type { JournalEntry } from "./types";

export type InsightTone = "ok" | "watch" | "info";

export type DiaryInsight = {
  tone: InsightTone;
  title: string;
  detail: string;
};

export type SparkPoint = { key: string; label: string; value: number };

export type DiaryInsightView = {
  spark: SparkPoint[];
  sparkCaption?: string;
  insight: DiaryInsight | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toLocalDateIso(new Date(y, m - 1, d + delta));
}

export function lastDays(today: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDaysIso(today, -i));
  return out;
}

function weekdayShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { weekday: "short" });
}

function sparkFromDays(
  days: string[],
  valueOf: (iso: string) => number,
): SparkPoint[] {
  return days.map((key) => ({
    key,
    label: weekdayShort(key).replace(".", ""),
    value: valueOf(key),
  }));
}

function entrySec(e: JournalEntry): number {
  const fromFields = num(e.fields?.totalSec);
  if (fromFields != null && fromFields > 0) return Math.round(fromFields);
  const fromMin = num(e.fields?.totalMin);
  if (fromMin != null && fromMin > 0) return Math.round(fromMin * 60);
  return 0;
}

function entryMl(e: JournalEntry): number {
  const fromFields = num(e.fields?.ml);
  if (fromFields != null && fromFields > 0) return Math.round(fromFields);
  const m = e.value.match(/(\d+)\s*мл/i);
  return m ? Number(m[1]) : 0;
}

function entryEndMs(e: JournalEntry): number {
  const end = num(e.fields?.endMs);
  if (end != null) return end;
  const start = entryStartMs(e);
  const sec = entrySec(e);
  return sec > 0 ? start + sec * 1000 : start;
}

function entryStartMs(e: JournalEntry): number {
  const s = num(e.fields?.startMs);
  if (s != null) return s;
  if (e.createdAt) {
    const t = Date.parse(e.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(`${e.date}T12:00:00`);
}

function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : Math.round((v[mid - 1]! + v[mid]!) / 2);
}

function formatMin(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} ч ${r} мин` : `${h} ч`;
}

function typicalFeedGapMin(months: number | null): { min: number; max: number } {
  if (months == null || months < 1) return { min: 90, max: 180 };
  if (months < 3) return { min: 120, max: 210 };
  if (months < 6) return { min: 150, max: 240 };
  return { min: 180, max: 300 };
}

function typicalSleepH(months: number | null): { min: number; max: number } {
  if (months == null || months < 1) return { min: 14, max: 17 };
  if (months < 3) return { min: 13, max: 16 };
  if (months < 6) return { min: 12, max: 15 };
  if (months < 12) return { min: 11, max: 14 };
  return { min: 10, max: 13 };
}

function emptyView(detail: string): DiaryInsightView {
  return {
    spark: [],
    insight: {
      tone: "info",
      title: "Пока рано судить",
      detail,
    },
  };
}

/** ГВ: засекают, чтобы видеть СВОЙ ритм — интервал, стороны, не «норму из интернета». */
export function breastfeedingInsight(
  entries: JournalEntry[],
  birthDate?: string | null,
  now = Date.now(),
): DiaryInsightView {
  const today = toLocalDateIso(new Date(now));
  const days = lastDays(today, 7);
  const byDay = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const list = byDay.get(e.date) ?? [];
    list.push(e);
    byDay.set(e.date, list);
  }
  const spark = sparkFromDays(days, (iso) => (byDay.get(iso) ?? []).length);
  const sparkCaption = "кормлений за день · 7 дней";

  const sorted = [...entries].sort((a, b) => entryEndMs(a) - entryEndMs(b));
  if (sorted.length < 2) {
    return {
      spark,
      sparkCaption,
      insight: {
        tone: "info",
        title: "Засекаете, чтобы увидеть ритм",
        detail:
          "Длина одного прикладывания почти ничего не говорит. Важнее, как часто малыш берёт грудь и меняются ли интервалы день ото дня. Две–три записи — и появится ваш график.",
      },
    };
  }

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = entryStartMs(sorted[i]!) - entryEndMs(sorted[i - 1]!);
    if (gap > 20 * 60_000 && gap < 12 * 60 * 60_000) gaps.push(gap / 60_000);
  }
  const ownGap = median(gaps);
  const last = sorted[sorted.length - 1]!;
  const sinceMin = (now - entryEndMs(last)) / 60_000;
  const months = ageMonths(birthDate);
  const typical = typicalFeedGapMin(months);

  const recent = sorted.slice(-12);
  let left = 0;
  let right = 0;
  for (const e of recent) {
    left += num(e.fields?.leftSec) ?? 0;
    right += num(e.fields?.rightSec) ?? 0;
  }
  const sides = left + right;

  const todayList = byDay.get(today) ?? [];
  const threeH = now - 3 * 60 * 60_000;
  const cluster = todayList.filter((e) => entryStartMs(e) >= threeH).length;

  const weekCounts = spark.map((p) => p.value).filter((n) => n > 0);
  const avgCount = weekCounts.length
    ? weekCounts.reduce((a, b) => a + b, 0) / weekCounts.length
    : 0;

  if (sides > 600 && (left < sides * 0.25 || right < sides * 0.25)) {
    const weak = left < right ? "левая" : "правая";
    return {
      spark,
      sparkCaption,
      insight: {
        tone: "watch",
        title: `${weak} заметно меньше`,
        detail: `За последние кормления ${Math.round((left / 60) * 10) / 10} мин слева и ${Math.round((right / 60) * 10) / 10} мин справа. Так бывает, если малыш предпочитает одну сторону. Чередуйте старт — и смотрите, нет ли уплотнения. Это не диагноз.`,
      },
    };
  }

  if (cluster >= 3) {
    return {
      spark,
      sparkCaption,
      insight: {
        tone: "info",
        title: "Кластерное кормление",
        detail: `За последние 3 часа уже ${cluster} раз. У грудничков так бывает вечером или в скачок роста: короткие частые прикладывания — не «мало молока само по себе». Смотрите мокрые подгузники и вес.`,
      },
    };
  }

  if (ownGap != null && sinceMin > ownGap * 1.7 && sinceMin > typical.max) {
    return {
      spark,
      sparkCaption,
      insight: {
        tone: "watch",
        title: "Пауза длиннее вашего ритма",
        detail: `Обычно у вас ≈ ${formatMin(ownGap)} между кормлениями, сейчас уже ${formatMin(sinceMin)}. Если малыш спит и спокоен — ок. Если беспокоится — не ждите «по часам». Ориентир, не правило.`,
      },
    };
  }

  if (ownGap != null) {
    const remain = Math.max(0, ownGap - sinceMin);
    const todayN = todayList.length;
    const vsAvg =
      avgCount >= 2
        ? todayN >= avgCount + 2
          ? ` Сегодня уже ${todayN} — чуть чаще, чем обычно за неделю (${avgCount.toFixed(0)}).`
          : todayN > 0 && todayN + 2 <= avgCount
            ? ` Сегодня ${todayN}, за неделю в среднем ${avgCount.toFixed(0)}.`
            : ""
        : "";
    return {
      spark,
      sparkCaption,
      insight: {
        tone: "ok",
        title: remain < 15 ? "Скоро по вашему ритму" : "Ритм держится",
        detail: `Ваш интервал за последние записи ≈ ${formatMin(ownGap)}. С последнего кормления ${formatMin(sinceMin)}${remain >= 15 ? `, обычно следующее через ~${formatMin(remain)}` : "."}${vsAvg} Длительность одного раза менее важна, чем регулярность и набор веса.`,
      },
    };
  }

  return {
    spark,
    sparkCaption,
    insight: {
      tone: "info",
      title: "Копим ваш график",
      detail:
        "Ещё несколько кормлений с таймером — посчитаю обычный интервал именно у вас, а не «как в таблице».",
    },
  };
}

export function formulaInsight(
  entries: JournalEntry[],
  now = Date.now(),
): DiaryInsightView {
  const today = toLocalDateIso(new Date(now));
  const days = lastDays(today, 7);
  const mlByDay = new Map<string, number>();
  for (const e of entries) {
    mlByDay.set(e.date, (mlByDay.get(e.date) ?? 0) + entryMl(e));
  }
  const spark = sparkFromDays(days, (iso) => mlByDay.get(iso) ?? 0);
  const sparkCaption = "мл смеси за день";
  const todayMl = mlByDay.get(today) ?? 0;
  const prev = spark.slice(0, -1).map((p) => p.value).filter((n) => n > 0);
  const avg = prev.length ? Math.round(prev.reduce((a, b) => a + b, 0) / prev.length) : 0;
  const sorted = [...entries].sort((a, b) => entryStartMs(a) - entryStartMs(b));
  if (!sorted.length) {
    return emptyView(
      "Смесь засекают, чтобы видеть суточный объём и не кормить «на глаз» каждый раз по-разному. Первая порция — и появится график.",
    );
  }
  const since = (now - entryStartMs(sorted[sorted.length - 1]!)) / 60_000;
  if (avg > 0 && todayMl > 0 && todayMl < avg * 0.55) {
    return {
      spark,
      sparkCaption,
      insight: {
        tone: "watch",
        title: "Сегодня меньше обычного объёма",
        detail: `Сейчас ${todayMl} мл, за неделю обычно ≈ ${avg} мл. День ещё идёт — или малыш чаще у груди. Смотрите вес и мокрые подгузники, не только миллилитры.`,
      },
    };
  }
  return {
    spark,
    sparkCaption,
    insight: {
      tone: "ok",
      title: since < 180 ? "Последняя порция недавно" : "Объём копится за сутки",
      detail: `С последней бутылочки ${formatMin(since)}. Сегодня ${todayMl} мл${avg ? `, обычно за день ≈ ${avg} мл` : ""}. Ориентир по банке и педиатру важнее «среднего по интернету».`,
    },
  };
}

export function sleepInsight(
  entries: JournalEntry[],
  birthDate?: string | null,
  now = Date.now(),
): DiaryInsightView {
  const today = toLocalDateIso(new Date(now));
  const days = lastDays(today, 7);
  const secByDay = new Map<string, number>();
  for (const e of entries) {
    secByDay.set(e.date, (secByDay.get(e.date) ?? 0) + entrySec(e));
  }
  const spark = sparkFromDays(
    days,
    (iso) => Math.round(((secByDay.get(iso) ?? 0) / 3600) * 10) / 10,
  );
  const sparkCaption = "часов сна за день";
  const todayH = (secByDay.get(today) ?? 0) / 3600;
  const months = ageMonths(birthDate);
  const range = typicalSleepH(months);
  const todayList = (entries.filter((e) => e.date === today) ?? []).sort(
    (a, b) => entryStartMs(a) - entryStartMs(b),
  );
  if (!todayList.length && todayH === 0) {
    return {
      spark,
      sparkCaption,
      insight: {
        tone: "info",
        title: "Пока рано судить",
        detail:
          "Сон засекают, чтобы увидеть, сколько получилось за сутки и как длинны промежутки бодрствования — не «идеальные часы из приложения».",
      },
    };
  }

  let longest = 0;
  for (const e of todayList) longest = Math.max(longest, entrySec(e));

  if (todayH > 0 && months != null && todayH < range.min - 2) {
    return {
      spark,
      sparkCaption,
      insight: {
        tone: "watch",
        title: "Сна меньше обычного ориентира",
        detail: `Сегодня ≈ ${todayH.toFixed(1)} ч. Для ~${months} мес. часто бывает ${range.min}–${range.max} ч. Если так несколько дней подряд — к педиатру. Один короткий день после прогулки или гостей бывает.`,
      },
    };
  }

  return {
    spark,
    sparkCaption,
    insight: {
      tone: "ok",
      title: longest > 0 ? `Самый длинный кусок ${formatMin(longest / 60)}` : "Сон складывается из кусков",
      detail: `За сутки ${todayH > 0 ? `≈ ${todayH.toFixed(1)} ч` : "пока мало отметок"}${months != null ? `. Ориентир для ~${months} мес.: ${range.min}–${range.max} ч` : ""}. Важно не одно «идеальное» окно, а как малыш восстанавливается за день.`,
    },
  };
}

export function diaperInsight(
  entries: JournalEntry[],
  birthDate?: string | null,
  now = Date.now(),
): DiaryInsightView {
  const today = toLocalDateIso(new Date(now));
  const days = lastDays(today, 7);
  const wetOf = (e: JournalEntry) => {
    const k = String(e.fields?.kind || "");
    return k === "wet" || k === "both";
  };
  const wetByDay = new Map<string, number>();
  for (const e of entries) {
    if (wetOf(e)) wetByDay.set(e.date, (wetByDay.get(e.date) ?? 0) + 1);
  }
  const spark = sparkFromDays(days, (iso) => wetByDay.get(iso) ?? 0);
  const sparkCaption = "мокрых подгузников";
  const todayWet = wetByDay.get(today) ?? 0;
  const months = ageMonths(birthDate);
  const lastWet = [...entries]
    .filter(wetOf)
    .sort((a, b) => entryStartMs(b) - entryStartMs(a))[0];
  const since = lastWet ? (now - entryStartMs(lastWet)) / 60_000 : null;

  if (entries.filter((e) => e.date === today).length === 0) {
    return {
      spark,
      sparkCaption,
      insight: emptyView(
        "Подгузник — простой способ понять, хватает ли молока/смеси: мокрые за сутки важнее «красивой» длительности кормления.",
      ).insight,
    };
  }

  if (months != null && months < 6 && todayWet < 4 && now - Date.parse(`${today}T12:00:00`) > 8 * 3600_000) {
    return {
      spark,
      sparkCaption,
      insight: {
        tone: "watch",
        title: "Мало мокрых за день",
        detail: `Сегодня мокрых: ${todayWet}. У малышей до полугода часто ждут 5–6+ мокрых за сутки как грубый ориентир, что жидкости хватает. Если так несколько дней — к врачу. Один день с недоучётом бывает.`,
      },
    };
  }

  return {
    spark,
    sparkCaption,
    insight: {
      tone: "ok",
      title: since != null ? `С последней смены ${formatMin(since)}` : "Смены идут",
      detail: `Мокрых сегодня ${todayWet}. Это не лабораторный анализ — зато видно, не «засох» ли день. Сыпь в записях тоже имеет смысл копить, если повторяется.`,
    },
  };
}

export function waterInsight(
  entries: JournalEntry[],
  now = Date.now(),
): DiaryInsightView {
  const today = toLocalDateIso(new Date(now));
  const days = lastDays(today, 7);
  const mlByDay = new Map<string, number>();
  for (const e of entries) {
    mlByDay.set(e.date, (mlByDay.get(e.date) ?? 0) + entryMl(e));
  }
  const spark = sparkFromDays(days, (iso) => mlByDay.get(iso) ?? 0);
  const sparkCaption = "мл воды за день";
  const vals = spark.map((p) => p.value).filter((n) => n > 0);
  if (!vals.length) {
    return emptyView("Вода мамы — чтобы не гадать вечером, «пила ли я сегодня».");
  }
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const todayMl = mlByDay.get(today) ?? 0;
  return {
    spark,
    sparkCaption,
    insight: {
      tone: todayMl >= avg * 0.8 || todayMl >= 1500 ? "ok" : "info",
      title: `За неделю обычно ≈ ${avg} мл`,
      detail: `Сегодня ${todayMl} мл. При ГВ жажда сильнее — график помогает не забывать стакан, а не «выполнять норму из интернета».`,
    },
  };
}

export function walkInsight(
  entries: JournalEntry[],
  now = Date.now(),
): DiaryInsightView {
  const today = toLocalDateIso(new Date(now));
  const days = lastDays(today, 7);
  const minByDay = new Map<string, number>();
  for (const e of entries) {
    minByDay.set(e.date, (minByDay.get(e.date) ?? 0) + Math.round(entrySec(e) / 60));
  }
  const spark = sparkFromDays(days, (iso) => minByDay.get(iso) ?? 0);
  const sparkCaption = "минут на улице";
  const todayMin = minByDay.get(today) ?? 0;
  const prev = spark.filter((p) => p.value > 0);
  if (!prev.length && todayMin === 0) {
    return emptyView("Прогулку засекают, чтобы видеть, были ли вы вообще на воздухе — не для медали.");
  }
  return {
    spark,
    sparkCaption,
    insight: {
      tone: "ok",
      title: todayMin > 0 ? `Сегодня ${todayMin} мин` : "Сегодня ещё не гуляли",
      detail:
        "Сон и аппетит часто лучше в дни с улицей. График — чтобы заметить неделю без воздуха, а не стыдиться короткой прогулки.",
    },
  };
}

export function healthInsight(
  entries: JournalEntry[],
  now = Date.now(),
): DiaryInsightView {
  const today = toLocalDateIso(new Date(now));
  const days = lastDays(today, 7);
  const maxTemp = (iso: string) => {
    let max = 0;
    for (const e of entries) {
      if (e.date !== iso) continue;
      const t = num(e.fields?.temp);
      if (t != null) max = Math.max(max, t);
    }
    return max;
  };
  const spark = sparkFromDays(days, maxTemp);
  const sparkCaption = "макс. температура";
  const todayMax = maxTemp(today);
  const feverDays = spark.filter((p) => p.value >= 38).length;
  if (!entries.length) {
    return emptyView("Температуру пишут, чтобы увидеть, это разовый скачок или держится днями — это важно врачу.");
  }
  if (todayMax >= 38) {
    return {
      spark,
      sparkCaption,
      insight: {
        tone: "watch",
        title: `Сейчас до ${todayMax.toFixed(1)} °C`,
        detail: `За неделю дней с ≥38 °C: ${feverDays}. Мая не ставит диагноз. Если малышу меньше 3 месяцев или температура держится — к врачу.`,
      },
    };
  }
  return {
    spark,
    sparkCaption,
    insight: {
      tone: "ok",
      title: todayMax > 0 ? `Сегодня макс. ${todayMax.toFixed(1)} °C` : "Жара в записях нет",
      detail:
        "Имеет смысл писать не только градус, но и день: тогда видно, спадает или ползёт вверх.",
    },
  };
}

export function solidsInsight(
  entries: JournalEntry[],
  now = Date.now(),
): DiaryInsightView {
  const today = toLocalDateIso(new Date(now));
  const days = lastDays(today, 7);
  const countByDay = new Map<string, number>();
  const foods = new Set<string>();
  let rash = 0;
  for (const e of entries) {
    countByDay.set(e.date, (countByDay.get(e.date) ?? 0) + 1);
    const food = String(e.fields?.food || "").trim();
    if (food) foods.add(food.toLowerCase());
    if (String(e.fields?.reaction || "") === "rash" || /сыпь/i.test(e.note || "")) {
      rash += 1;
    }
  }
  const spark = sparkFromDays(days, (iso) => countByDay.get(iso) ?? 0);
  const sparkCaption = "приёмов прикорма";
  if (!entries.length) {
    return emptyView(
      "Прикорм ведут, чтобы помнить, что уже пробовали и не было ли сыпи — иначе через месяц всё смешается.",
    );
  }
  if (rash > 0) {
    return {
      spark,
      sparkCaption,
      insight: {
        tone: "watch",
        title: "Были реакции в записях",
        detail: `Отметок «сыпь / реакция»: ${rash}. Имеет смысл не вводить сразу пачку новых продуктов и показать педиатру, если повторяется. Уникальных продуктов в дневнике: ${foods.size}.`,
      },
    };
  }
  return {
    spark,
    sparkCaption,
    insight: {
      tone: "ok",
      title: `${foods.size} продуктов в дневнике`,
      detail: `Сегодня приёмов: ${countByDay.get(today) ?? 0}. Смысл журнала — не «съел ложку», а список безопасных продуктов и тех, что ещё не пробовали.`,
    },
  };
}

export function growthSpark(
  entries: JournalEntry[],
  now = Date.now(),
): DiaryInsightView {
  const today = toLocalDateIso(new Date(now));
  const days = lastDays(today, 7);
  const lastWeight = new Map<string, number>();
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const w = num(e.fields?.weightKg);
    if (w != null && w > 0) lastWeight.set(e.date, w);
  }
  let cursor: number | null = null;
  const spark = days.map((key) => {
    if (lastWeight.has(key)) cursor = lastWeight.get(key)!;
    return {
      key,
      label: weekdayShort(key).replace(".", ""),
      value: cursor ?? 0,
    };
  });
  const sparkCaption = "вес, кг";
  const vals = spark.map((p) => p.value).filter((n) => n > 0);
  if (vals.length < 2) {
    return {
      spark: vals.length ? spark : [],
      sparkCaption,
      insight: {
        tone: "info",
        title: "Рост смотрят по точкам, не по одной цифре",
        detail:
          "Одно взвешивание мало что значит. Две–три точки с разницей в дни — и видно, идёт ли набор, а не «нормально ли 8 кг вообще».",
      },
    };
  }
  const first = vals[0]!;
  const last = vals[vals.length - 1]!;
  const d = last - first;
  return {
    spark,
    sparkCaption,
    insight: {
      tone: d < -0.2 ? "watch" : "ok",
      title: d >= 0 ? "Вес за неделю не падает" : "Вес ушёл вниз на графике",
      detail: `С ${first.toFixed(1)} до ${last.toFixed(1)} кг на отрезке графика (${d >= 0 ? "+" : ""}${d.toFixed(1)} кг). Это грубо: разные весы и время дня врут. Решение — у педиатра.`,
    },
  };
}
