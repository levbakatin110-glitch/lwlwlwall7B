import type { JournalEntry } from "./types";
import { ageMonths } from "./growth-norms";

export type DayEventKind =
  | "sleep"
  | "breastfeeding"
  | "formula"
  | "solids"
  | "growth";

export type DayEvent = {
  id: string;
  kind: DayEventKind;
  title: string;
  detail: string;
  sortAt: number;
};

export type DayTotals = {
  sleepSec: number;
  sleepNapSec: number;
  sleepNightSec: number;
  sleepCount: number;
  bfCount: number;
  bfSec: number;
  bfLeftSec: number;
  bfRightSec: number;
  formulaMl: number;
  formulaCount: number;
  solidsCount: number;
};

export type DayNormHint = {
  id: string;
  tone: "ok" | "watch" | "info";
  title: string;
  detail: string;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseDurationFromValue(value: string): number | null {
  const t = value.toLowerCase();
  const hms = t.match(/(\d+)\s*[ч:]\s*(\d{1,2})\s*(?::\s*(\d{1,2}))?/);
  if (hms) {
    const h = Number(hms[1]);
    const m = Number(hms[2]);
    const s = hms[3] ? Number(hms[3]) : 0;
    if ([h, m, s].every(Number.isFinite)) return h * 3600 + m * 60 + s;
  }
  const onlyH = t.match(/(\d+(?:[.,]\d+)?)\s*ч/);
  if (onlyH) {
    const h = Number(onlyH[1].replace(",", "."));
    if (Number.isFinite(h)) return Math.round(h * 3600);
  }
  const range = t.match(/(\d{1,2}):(\d{2})\s*[–\-—]\s*(\d{1,2}):(\d{2})/);
  if (range) {
    let a = Number(range[1]) * 60 + Number(range[2]);
    let b = Number(range[3]) * 60 + Number(range[4]);
    if (b < a) b += 24 * 60;
    return (b - a) * 60;
  }
  return null;
}

function entrySec(e: JournalEntry): number {
  const fromFields = num(e.fields?.totalSec);
  if (fromFields != null && fromFields > 0) return Math.round(fromFields);
  return parseDurationFromValue(e.value) ?? 0;
}

function entryMl(e: JournalEntry): number {
  const fromFields = num(e.fields?.ml);
  if (fromFields != null && fromFields > 0) return Math.round(fromFields);
  const m = e.value.match(/(\d+)\s*мл/i);
  return m ? Number(m[1]) : 0;
}

function sortTime(e: JournalEntry): number {
  const from = e.fields?.from;
  if (typeof from === "string" && from) {
    const t = Date.parse(from);
    if (!Number.isNaN(t)) return t;
  }
  if (e.createdAt) {
    const t = Date.parse(e.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  const hm = e.value.match(/(\d{1,2}):(\d{2})/);
  if (hm && e.date) {
    const d = new Date(`${e.date}T${hm[1].padStart(2, "0")}:${hm[2]}:00`);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  if (e.date) {
    const d = Date.parse(`${e.date}T12:00:00`);
    if (!Number.isNaN(d)) return d;
  }
  return 0;
}

export function formatDurationRu(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h} ч ${m} мин`;
  if (h > 0) return `${h} ч`;
  if (m > 0) return `${m} мин`;
  if (s > 0) return `${s} сек`;
  return "—";
}

export function formatDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sleepTitle(e: JournalEntry): string {
  const kind = String(e.fields?.kind ?? "");
  if (kind === "night" || /ноч/i.test(e.value)) return "Ночной сон";
  if (kind === "nap" || /дневн|дрёма|дрема|сон/i.test(e.value))
    return "Дневной сон";
  return "Сон";
}

function sleepDetail(e: JournalEntry): string {
  const sec = entrySec(e);
  const parts: string[] = [];
  if (sec > 0) parts.push(formatDurationRu(sec));
  const from = typeof e.fields?.from === "string" ? e.fields.from : "";
  const to = typeof e.fields?.to === "string" ? e.fields.to : "";
  if (from && to) {
    const a = new Date(from);
    const b = new Date(to);
    if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
      const fmt = (x: Date) =>
        x.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      parts.push(`с ${fmt(a)} до ${fmt(b)}`);
    }
  } else {
    const range = e.value.match(/(\d{1,2}:\d{2})\s*[–\-—]\s*(\d{1,2}:\d{2})/);
    if (range) parts.push(`с ${range[1]} до ${range[2]}`);
  }
  return parts.join(" · ") || e.value || "запись";
}

function bfTitle(e: JournalEntry): string {
  const side = String(e.fields?.side ?? "");
  if (side === "left" || /лев/i.test(e.value)) return "Кормление · левая";
  if (side === "right" || /прав/i.test(e.value)) return "Кормление · правая";
  return "Кормление грудью";
}

function bfDetail(e: JournalEntry): string {
  const sec = entrySec(e);
  const parts: string[] = [];
  const t = e.createdAt ? new Date(e.createdAt) : null;
  if (t && !Number.isNaN(t.getTime())) {
    parts.push(
      t.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    );
  }
  if (sec > 0) parts.push(formatDurationRu(sec));
  const left = num(e.fields?.leftSec);
  const right = num(e.fields?.rightSec);
  if (left != null && left > 0) parts.push(`левая ${formatDurationRu(left)}`);
  if (right != null && right > 0) parts.push(`правая ${formatDurationRu(right)}`);
  return parts.join(" · ") || e.value || "запись";
}

export function buildDaySummary(input: {
  date: string;
  journals: Record<string, JournalEntry[]>;
}): { totals: DayTotals; events: DayEvent[] } {
  const { date, journals } = input;
  const sleep = (journals.sleep ?? []).filter((e) => e.date === date);
  const bf = (journals.breastfeeding ?? []).filter((e) => e.date === date);
  const formula = (journals.formula ?? []).filter((e) => e.date === date);
  const solids = (journals.solids ?? []).filter((e) => e.date === date);
  const growth = (journals.growth ?? []).filter((e) => e.date === date);

  const totals: DayTotals = {
    sleepSec: 0,
    sleepNapSec: 0,
    sleepNightSec: 0,
    sleepCount: sleep.length,
    bfCount: bf.length,
    bfSec: 0,
    bfLeftSec: 0,
    bfRightSec: 0,
    formulaMl: 0,
    formulaCount: formula.length,
    solidsCount: solids.length,
  };

  const events: DayEvent[] = [];

  for (const e of sleep) {
    const sec = entrySec(e);
    totals.sleepSec += sec;
    const kind = String(e.fields?.kind ?? "");
    if (kind === "night" || /ноч/i.test(e.value)) totals.sleepNightSec += sec;
    else totals.sleepNapSec += sec;
    events.push({
      id: e.id,
      kind: "sleep",
      title: sleepTitle(e),
      detail: sleepDetail(e),
      sortAt: sortTime(e),
    });
  }

  for (const e of bf) {
    const sec = entrySec(e);
    totals.bfSec += sec;
    totals.bfLeftSec += num(e.fields?.leftSec) ?? 0;
    totals.bfRightSec += num(e.fields?.rightSec) ?? 0;
    events.push({
      id: e.id,
      kind: "breastfeeding",
      title: bfTitle(e),
      detail: bfDetail(e),
      sortAt: sortTime(e),
    });
  }

  for (const e of formula) {
    const ml = entryMl(e);
    totals.formulaMl += ml;
    const t = e.createdAt ? new Date(e.createdAt) : null;
    const time =
      t && !Number.isNaN(t.getTime())
        ? t.toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
    events.push({
      id: e.id,
      kind: "formula",
      title: "Смесь",
      detail: [time, ml > 0 ? `${ml} мл` : e.value, e.fields?.brand]
        .filter(Boolean)
        .join(" · "),
      sortAt: sortTime(e),
    });
  }

  for (const e of solids) {
    events.push({
      id: e.id,
      kind: "solids",
      title: "Прикорм",
      detail: e.value || "запись",
      sortAt: sortTime(e),
    });
  }

  for (const e of growth) {
    events.push({
      id: e.id,
      kind: "growth",
      title: "Рост / вес",
      detail: e.value || "запись",
      sortAt: sortTime(e),
    });
  }

  events.sort((a, b) => b.sortAt - a.sortAt);

  return { totals, events };
}

/** Грубые ориентиры по возрасту. Не диагноз и не замена педиатру. */
export function dayNormHints(input: {
  birthDate?: string | null;
  totals: DayTotals;
}): DayNormHint[] {
  const months = ageMonths(input.birthDate);
  const { totals } = input;
  const hints: DayNormHint[] = [];
  const sleepH = totals.sleepSec / 3600;
  const feeds = totals.bfCount + totals.formulaCount;

  if (months == null) {
    hints.push({
      id: "age",
      tone: "info",
      title: "Укажите дату рождения",
      detail:
        "В профиле малыша — тогда смогу сравнить сон и кормления с типичным ориентиром по возрасту.",
    });
    return hints;
  }

  let sleepMin = 11;
  let sleepMax = 17;
  let feedMin = 6;
  let feedMax = 12;
  if (months < 1) {
    sleepMin = 14;
    sleepMax = 17;
    feedMin = 8;
    feedMax = 12;
  } else if (months < 3) {
    sleepMin = 13;
    sleepMax = 16;
    feedMin = 7;
    feedMax = 10;
  } else if (months < 6) {
    sleepMin = 12;
    sleepMax = 15;
    feedMin = 6;
    feedMax = 8;
  } else if (months < 12) {
    sleepMin = 11;
    sleepMax = 14;
    feedMin = 5;
    feedMax = 7;
  } else {
    sleepMin = 10;
    sleepMax = 13;
    feedMin = 4;
    feedMax = 6;
  }

  const hasSleep = totals.sleepCount > 0;
  const hasFeed = feeds > 0;

  if (!hasSleep && !hasFeed) {
    hints.push({
      id: "empty",
      tone: "info",
      title: "Пока мало записей за день",
      detail:
        "Отметьте сон и кормления в дневниках — здесь появятся суммы и мягкий ориентир.",
    });
    return hints;
  }

  if (hasSleep) {
    if (sleepH < sleepMin - 1.5) {
      hints.push({
        id: "sleep-low",
        tone: "watch",
        title: "Сна меньше обычного ориентира",
        detail: `Сегодня ≈ ${formatDurationRu(totals.sleepSec)}. Для ~${months} мес. часто бывает ${sleepMin}–${sleepMax} ч/сутки. Если так несколько дней — стоит обсудить с педиатром.`,
      });
    } else if (sleepH > sleepMax + 2) {
      hints.push({
        id: "sleep-high",
        tone: "watch",
        title: "Сна больше обычного",
        detail: `Сегодня ≈ ${formatDurationRu(totals.sleepSec)}. Ориентир для ~${months} мес.: ${sleepMin}–${sleepMax} ч. Иногда так при скачке роста или после бурного дня.`,
      });
    } else {
      hints.push({
        id: "sleep-ok",
        tone: "ok",
        title: "Сон в пределах ориентира",
        detail: `≈ ${formatDurationRu(totals.sleepSec)} за день. Для ~${months} мес. типично ${sleepMin}–${sleepMax} ч — это не диагноз, только ориентир.`,
      });
    }
  }

  if (hasFeed) {
    if (feeds < feedMin - 1) {
      hints.push({
        id: "feed-low",
        tone: "watch",
        title: "Кормлений меньше обычного",
        detail: `Сегодня ${feeds} раз(а). Ориентир для ~${months} мес.: примерно ${feedMin}–${feedMax}. Смотрите на мокрые подгузники, вес и самочувствие.`,
      });
    } else if (feeds > feedMax + 2) {
      hints.push({
        id: "feed-high",
        tone: "info",
        title: "Кормлений многовато",
        detail: `Сегодня ${feeds}. Для ~${months} мес. чаще ${feedMin}–${feedMax}. У грудничков так бывает в «кластерные» дни — нормально, если малыш спокоен.`,
      });
    } else {
      hints.push({
        id: "feed-ok",
        tone: "ok",
        title: "Кормления выглядят обычно",
        detail: `Сегодня ${feeds} раз(а). Ориентир ${feedMin}–${feedMax} для ~${months} мес. Главное — набор веса и настроение малыша.`,
      });
    }
  }

  if (totals.formulaMl > 0 && months < 6) {
    hints.push({
      id: "formula",
      tone: "info",
      title: `Смесь за день: ${totals.formulaMl} мл`,
      detail:
        "Объём смеси очень индивидуален. Ориентир обычно пишет педиатр / на банке — мы только суммируем ваши записи.",
    });
  }

  return hints;
}

export function ageLabelRu(birthDate?: string | null): string | null {
  const months = ageMonths(birthDate);
  if (months == null) return null;
  if (months < 1) {
    if (!birthDate) return null;
    const b = new Date(birthDate);
    const days = Math.max(
      0,
      Math.floor((Date.now() - b.getTime()) / 86_400_000),
    );
    if (days === 0) return "новорождённый";
    if (days === 1) return "1 день";
    if (days < 5) return `${days} дня`;
    return `${days} дней`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) {
    if (m === 1) return "1 месяц";
    if (m > 1 && m < 5) return `${m} месяца`;
    return `${m} месяцев`;
  }
  const yPart =
    y === 1 ? "1 год" : y > 1 && y < 5 ? `${y} года` : `${y} лет`;
  if (m === 0) return yPart;
  if (m === 1) return `${yPart} 1 месяц`;
  if (m < 5) return `${yPart} ${m} месяца`;
  return `${yPart} ${m} месяцев`;
}
