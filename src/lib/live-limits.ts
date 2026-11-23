/** После этого отсчёт считаем забытым и не пишем его в дневник сами. */
export const LIVE_FORGOT_SEC = {
  walk: 6 * 3600,
  sleep: 16 * 3600,
  bf: 2 * 3600,
  contractions: 10 * 60,
  timer: 10 * 3600,
} as const;

export function forgotTimer(elapsedSec: number, maxSec: number): boolean {
  return elapsedSec > maxSec;
}

export function forgotHint(maxSec: number): string {
  if (maxSec >= 3600) {
    const h = Math.round(maxSec / 3600);
    return `Больше ${h} ч. Похоже, отсчёт забыли.`;
  }
  const m = Math.round(maxSec / 60);
  return `Больше ${m} мин. Похоже, отсчёт забыли.`;
}
