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
    return {
      ok: false,
      code: "no_self_serve",
      error:
        "Консультанта предлагаем, когда по дневнику видно, что вам тяжело. Пока можно просто вести записи.",
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
    return {
      ok: false,
      code: "not_eligible",
      error:
        "Консультанта подключаем, когда по дневнику видно, что вам тяжело. Пока можно просто вести записи — этого достаточно.",
    };
  }

  return { ok: true };
}
