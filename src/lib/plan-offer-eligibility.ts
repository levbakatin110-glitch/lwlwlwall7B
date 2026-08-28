import { buildDaySummary, dayNormHints } from "@/lib/day-summary";
import type { PlanTopic } from "@/lib/plan-products";
import type { JournalEntry } from "@/lib/types";

/** С какого дня показываем оффер (если сработал триггер на 1–2 день) */
export const PLAN_OFFER_DAY_MIN = 3;
/** До этого дня держим оффер после триггера; с 8-го — только при свежих отклонениях */
export const PLAN_OFFER_DAY_MAX = 7;
/** Дни, по которым решаем, показывать ли оффер на 3–7 */
export const PLAN_OFFER_TRIGGER_FROM = 1;
export const PLAN_OFFER_TRIGGER_TO = 2;

export type PlanOfferEligibility = {
  uniqueDays: number;
  /** Календарный день с первой записи: 1 = день старта */
  diaryDay: number;
  hasConcerns: boolean;
  showOffer: boolean;
  showTeaser: boolean;
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

/** Было ли отклонение хотя бы в один из календарных дней [fromDay…toDay] дневника */
function anyConcernInDiaryDayRange(input: {
  firstDate: string;
  fromDay: number;
  toDay: number;
  topic: PlanTopic;
  journals: Record<string, JournalEntry[]>;
  birthDate?: string | null;
}): boolean {
  const { firstDate, fromDay, toDay, topic, journals, birthDate } = input;
  for (let d = fromDay; d <= toDay; d++) {
    const date = addDaysToYmd(firstDate, d - 1);
    if (
      dateHasTopicConcern({ date, topic, journals, birthDate })
    ) {
      return true;
    }
  }
  return false;
}

export function evaluatePlanOfferEligibility(input: {
  topic: PlanTopic;
  entries: JournalEntry[];
  journals: Record<string, JournalEntry[]>;
  birthDate?: string | null;
}): PlanOfferEligibility {
  const dates = uniqueDates(input.entries);
  const uniqueDays = dates.length;
  const diaryDay = diaryDayFromFirstEntry(dates);

  if (diaryDay < PLAN_OFFER_DAY_MIN) {
    return {
      uniqueDays,
      diaryDay,
      hasConcerns: false,
      showOffer: false,
      showTeaser: uniqueDays > 0,
    };
  }

  const firstDate = dates[0]!;
  let hasConcerns: boolean;

  if (diaryDay <= PLAN_OFFER_DAY_MAX) {
    // Дни 3–7: оффер, если на 1-м или 2-м дне было хоть одно отклонение
    // (даже если с 3-го по 7-й уже всё в норме)
    hasConcerns = anyConcernInDiaryDayRange({
      firstDate,
      fromDay: PLAN_OFFER_TRIGGER_FROM,
      toDay: PLAN_OFFER_TRIGGER_TO,
      topic: input.topic,
      journals: input.journals,
      birthDate: input.birthDate,
    });
  } else {
    // День 8+: только если сегодня (с записью) есть отклонение
    const today = todayYmd();
    const todayHasData = input.entries.some((e) => e.date === today);
    hasConcerns = todayHasData
      ? dateHasTopicConcern({
          date: today,
          topic: input.topic,
          journals: input.journals,
          birthDate: input.birthDate,
        })
      : false;
  }

  return {
    uniqueDays,
    diaryDay,
    hasConcerns,
    showOffer: hasConcerns,
    showTeaser: false,
  };
}
