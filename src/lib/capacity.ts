/** Пока нет замеров: Мая обычно отвечает за несколько секунд. */
export const DEFAULT_ANSWER_SEC = 5;
export const ACCEPTABLE_WAIT_SEC = 60;
/** В горячий момент в ИИ пишет примерно каждый пятый, кто на сайте. */
export const CHATTY_SHARE = 0.2;

export function clampAnswerSec(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return DEFAULT_ANSWER_SEC;
  return Math.min(45, Math.max(2, Math.round(sec * 10) / 10));
}

/**
 * Сколько секунд ждёт последний, если `burst` человек нажали «отправить» сразу.
 * 50 слотов × ответ 5 сек: 50 → 0 сек, 60 → 1 сек, 100 → 5 сек.
 */
export function waitSecForBurst(
  burst: number,
  slots: number,
  answerSec: number,
): number {
  const s = clampAnswerSec(answerSec);
  const c = Math.max(1, Math.floor(slots));
  if (burst <= c) return 0;
  return Math.round(((burst - c) / c) * s * 10) / 10;
}

/** Сколько человек могут нажать «отправить» сразу, чтобы последний ждал не больше maxWaitSec. */
export function burstForWait(
  slots: number,
  answerSec: number,
  maxWaitSec: number,
): number {
  const s = clampAnswerSec(answerSec);
  const c = Math.max(1, Math.floor(slots));
  return Math.floor(c * (1 + Math.max(0, maxWaitSec) / s));
}

export function siteHeadroom(
  simultaneousSends: number,
  chattyShare = CHATTY_SHARE,
): number {
  const share =
    chattyShare > 0 && chattyShare <= 1 ? chattyShare : CHATTY_SHARE;
  return Math.floor(simultaneousSends / share);
}

export function waitSecFromQueue(
  waiting: number,
  slots: number,
  answerSec: number,
): number {
  if (waiting <= 0) return 0;
  return waitSecForBurst(slots + waiting, slots, answerSec);
}

export type CapacityModel = {
  answerSec: number;
  answerMeasured: boolean;
  slots: number;
  instant: number;
  waitAt60: number;
  waitAt100: number;
  withMinute: number;
  siteTypical: number;
  nowWaitSec: number;
};

export function capacityModel(input: {
  slots: number;
  answerSec: number;
  answerMeasured: boolean;
  waiting: number;
}): CapacityModel {
  const s = clampAnswerSec(input.answerSec);
  const slots = Math.max(1, Math.floor(input.slots));
  const withMinute = burstForWait(slots, s, ACCEPTABLE_WAIT_SEC);
  return {
    answerSec: s,
    answerMeasured: input.answerMeasured,
    slots,
    instant: slots,
    waitAt60: waitSecForBurst(60, slots, s),
    waitAt100: waitSecForBurst(100, slots, s),
    withMinute,
    siteTypical: siteHeadroom(withMinute),
    nowWaitSec: waitSecFromQueue(input.waiting, slots, s),
  };
}
