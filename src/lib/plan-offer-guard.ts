import { planOfferContextFromBackup } from "@/lib/backup-read";
import {
  evaluatePlanOfferEligibility,
  evaluatePlanSelfServeEligibility,
  PLAN_SELF_SERVE_MIN_DAYS,
} from "@/lib/plan-offer-eligibility";
import type { PlanTopic } from "@/lib/plan-products";
import type { JournalEntry } from "@/lib/types";

export type PlanOfferGuardResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

/** Серверная проверка: можно ли оформить разбор по теме */
export function assertPlanOfferEligible(input: {
  email: string;
  topic: PlanTopic;
  childId?: string;
  clientEntries?: JournalEntry[];
  /** Только если PLAN_OFFER_INSTANT=true на сервере */
  requestInstant?: boolean;
  /** Самостоятельный заказ со страницы /plan/order — без триггера «плохо» */
  voluntary?: boolean;
}): PlanOfferGuardResult {
  const serverInstant = process.env.PLAN_OFFER_INSTANT === "true";
  const instant = serverInstant && Boolean(input.requestInstant);

  const ctx = planOfferContextFromBackup(
    input.email,
    input.topic,
    input.childId,
    input.clientEntries,
  );

  if (ctx.entries.length < 1) {
    return {
      ok: false,
      code: "no_entries",
      error: "Добавьте хотя бы одну запись в дневник по этой теме.",
    };
  }

  if (input.voluntary) {
    const self = evaluatePlanSelfServeEligibility({ entries: ctx.entries });
    if (!self.canOrder) {
      return {
        ok: false,
        code: "not_enough_days",
        error: `Нужно хотя бы ${PLAN_SELF_SERVE_MIN_DAYS} разных дня с записями в дневнике.`,
      };
    }
    return { ok: true };
  }

  const eligibility = evaluatePlanOfferEligibility({
    topic: input.topic,
    entries: ctx.entries,
    journals: ctx.journals,
    birthDate: ctx.birthDate,
    instant,
  });

  if (!eligibility.showOffer) {
    return {
      ok: false,
      code: "not_eligible",
      error:
        "Разбор по дневнику сейчас недоступен. Если хотите заказать сами — откройте ссылку в профиле или внизу дневника.",
    };
  }

  return { ok: true };
}
