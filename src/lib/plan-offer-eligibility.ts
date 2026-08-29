import { buildDaySummary, dayNormHints } from "@/lib/day-summary";
import type { PlanTopic } from "@/lib/plan-products";
import type { JournalEntry } from "@/lib/types";

/** С какого дня дневника можно предлагать разбор */
export const PLAN_OFFER_DAY_MIN = 3;
/** Самостоятельный заказ — минимум дней с записями */
export const PLAN_SELF_SERVE_MIN_DAYS = 2;

export type PlanOfferEligibility = {
  uniqueDays: number;
  /** Календарный день с первой записи: 1 = день старта */
  diaryDay: number;
  hasConcerns: boolean;
  showOffer: boolean;
};

export type PlanSelfServeEligibility = {
  uniqueDays: number;
  canOrder: boolean;
};

function uniqueDates(entries: JournalEntry[]): string[] {
  return [...new Set(entries.map((e) => e.date))].sort();
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayYmd(): string {
  return ymdLocal(new Date());
}

function addDaysToYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return ymdLocal(d);
}

/** Календарных дней с первой записи по теме (включая сегодня) */
function diaryDayFromFirstEntry(dates: string[]): number {
  if (!dates.length) return 0;
  const first = new Date(`${dates[0]}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (Number.isNaN(first.getTime())) return dates.length;
  const diff = Math.floor((today.getTime() - first.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
}

const SLEEP_CONCERN_IDS = new Set(["sleep-low", "sleep-high"]);
const FEED_CONCERN_IDS = new Set(["feed-low", "feed-high"]);

function dateHasTopicConcern(input: {
  date: string;
  topic: PlanTopic;
  journals: Record<string, JournalEntry[]>;
  birthDate?: string | null;
}): boolean {
  const { date, topic, journals, birthDate } = input;
  const { totals } = buildDaySummary({ date, journals });
  const hasData =
    topic === "sleep"
      ? totals.sleepCount > 0
      : totals.bfCount + totals.formulaCount + totals.solidsCount > 0;
  if (!hasData) return false;

  const concernIds = topic === "sleep" ? SLEEP_CONCERN_IDS : FEED_CONCERN_IDS;
  const hints = dayNormHints({ birthDate, totals });
  if (hints.some((h) => concernIds.has(h.id) && h.tone === "watch")) {
    return true;
  }

  if (birthDate) return false;

  if (topic === "sleep") {
    const h = totals.sleepSec / 3600;
    return h < 9 || h > 16;
  }
  const feeds =
    totals.bfCount + totals.formulaCount > 0
      ? totals.bfCount + totals.formulaCount
      : totals.solidsCount;
  return feeds < 4 || feeds > 10;
}

/** Отклонение сегодня или вчера — только если в тот день есть записи */
function recentTopicConcern(input: {
  entries: JournalEntry[];
  topic: PlanTopic;
  journals: Record<string, JournalEntry[]>;
  birthDate?: string | null;
}): boolean {
  const today = todayYmd();
  const yesterday = addDaysToYmd(today, -1);
  const datesWithEntries = new Set(input.entries.map((e) => e.date));

  if (datesWithEntries.has(today)) {
    if (
      dateHasTopicConcern({
        date: today,
        topic: input.topic,
        journals: input.journals,
        birthDate: input.birthDate,
      })
    ) {
      return true;
    }
  }

  if (datesWithEntries.has(yesterday)) {
    return dateHasTopicConcern({
      date: yesterday,
      topic: input.topic,
      journals: input.journals,
      birthDate: input.birthDate,
    });
  }

  return false;
}

export function evaluatePlanSelfServeEligibility(input: {
  entries: JournalEntry[];
}): PlanSelfServeEligibility {
  const uniqueDays = uniqueDates(input.entries).length;
  return {
    uniqueDays,
    canOrder: uniqueDays >= PLAN_SELF_SERVE_MIN_DAYS,
  };
}

/** Яркий оффер в дневнике — только при реальных отклонениях */
export function evaluatePlanOfferEligibility(input: {
  topic: PlanTopic;
  entries: JournalEntry[];
  journals: Record<string, JournalEntry[]>;
  birthDate?: string | null;
  /** Тест: оффер при любой записи */
  instant?: boolean;
}): PlanOfferEligibility {
  const dates = uniqueDates(input.entries);
  const uniqueDays = dates.length;
  const diaryDay = diaryDayFromFirstEntry(dates);

  if (input.instant) {
    return {
      uniqueDays,
      diaryDay,
      hasConcerns: uniqueDays > 0,
      showOffer: uniqueDays > 0,
    };
  }

  if (diaryDay < PLAN_OFFER_DAY_MIN || uniqueDays < PLAN_SELF_SERVE_MIN_DAYS) {
    return {
      uniqueDays,
      diaryDay,
      hasConcerns: false,
      showOffer: false,
    };
  }

  const hasConcerns = recentTopicConcern({
    entries: input.entries,
    topic: input.topic,
    journals: input.journals,
    birthDate: input.birthDate,
  });

  return {
    uniqueDays,
    diaryDay,
    hasConcerns,
    showOffer: hasConcerns,
  };
}
