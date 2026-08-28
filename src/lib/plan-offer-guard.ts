import { planOfferContextFromBackup } from "@/lib/backup-read";
import { evaluatePlanOfferEligibility } from "@/lib/plan-offer-eligibility";
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

  const eligibility = evaluatePlanOfferEligibility({
    topic: input.topic,
    entries: ctx.entries,
    journals: ctx.journals,
    birthDate: ctx.birthDate,
    instant,
  });

  if (!eligibility.showOffer) {
    if (eligibility.showTeaser) {
      return {
        ok: false,
        code: "teaser_only",
        error:
          "Разбор по дневнику станет доступен позже — продолжайте вести записи.",
      };
    }
    return {
      ok: false,
      code: "not_eligible",
      error:
        "Сейчас разбор не предлагается — ведите дневник, и Мая подскажет, когда он будет уместен.",
    };
  }

  return { ok: true };
}
