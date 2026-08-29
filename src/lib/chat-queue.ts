/**
 * In-memory очередь чата (на процесс pm2).
 * Пока слот свободен — сразу к API. Если все заняты — ждём в очереди.
 * Если очередь переполнена или ждать слишком долго — вежливый отказ.
 */

export const CHAT_MAX_CONCURRENT = Math.max(
  1,
  Number(process.env.CHAT_MAX_CONCURRENT) || 80,
);

/** Сколько человек могут ждать слот (сверх активных) */
export const CHAT_MAX_WAITING = Math.max(
  0,
  Number(process.env.CHAT_MAX_WAITING) || 120,
);

/** Макс. ожидание в очереди, мс (клиентский abort ~55с) */
export const CHAT_QUEUE_WAIT_MS = Math.max(
  5_000,
  Number(process.env.CHAT_QUEUE_WAIT_MS) || 40_000,
);

type Waiter = {
  resolve: (ok: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
};

let active = 0;
const waiters: Waiter[] = [];

export function chatQueueSnapshot() {
  return {
    active,
    waiting: waiters.length,
    maxConcurrent: CHAT_MAX_CONCURRENT,
    maxWaiting: CHAT_MAX_WAITING,
  };
}

function pump() {
  while (active < CHAT_MAX_CONCURRENT && waiters.length > 0) {
    const next = waiters.shift()!;
    clearTimeout(next.timer);
    active += 1;
    next.resolve(true);
  }
}

export type ChatSlotLease = {
  release: () => void;
  waitedMs: number;
  fromQueue: boolean;
};

export type AcquireChatSlotResult =
  | { ok: true; lease: ChatSlotLease }
  | {
      ok: false;
      reason: "queue_full" | "wait_timeout";
      snapshot: ReturnType<typeof chatQueueSnapshot>;
    };

/**
 * Берёт слот: сразу или после ожидания в очереди.
 * release() вызывать когда стрим закончился / оборвался / ошибка до стрима.
 */
export function acquireChatSlot(
  waitMs = CHAT_QUEUE_WAIT_MS,
): Promise<AcquireChatSlotResult> {
  if (active < CHAT_MAX_CONCURRENT) {
    active += 1;
    let released = false;
    return Promise.resolve({
      ok: true,
      lease: {
        waitedMs: 0,
        fromQueue: false,
        release: () => {
          if (released) return;
          released = true;
          active = Math.max(0, active - 1);
          pump();
        },
      },
    });
  }

  if (waiters.length >= CHAT_MAX_WAITING) {
    return Promise.resolve({
      ok: false,
      reason: "queue_full",
      snapshot: chatQueueSnapshot(),
    });
  }

  const started = Date.now();
  return new Promise((resolve) => {
    const waiter: Waiter = {
      resolve: (got) => {
        if (!got) {
          resolve({
            ok: false,
            reason: "wait_timeout",
            snapshot: chatQueueSnapshot(),
          });
          return;
        }
        let released = false;
        resolve({
          ok: true,
          lease: {
            waitedMs: Date.now() - started,
            fromQueue: true,
            release: () => {
              if (released) return;
              released = true;
              active = Math.max(0, active - 1);
              pump();
            },
          },
        });
      },
      timer: setTimeout(() => {
        const idx = waiters.indexOf(waiter);
        if (idx >= 0) waiters.splice(idx, 1);
        waiter.resolve(false);
      }, waitMs),
    };
    waiters.push(waiter);
  });
}

export function chatBusyMessage(reason: "queue_full" | "wait_timeout") {
  if (reason === "queue_full") {
    return "Сейчас очень много мам пишет Мае одновременно. Подождите около минуты и попробуйте снова.";
  }
  return "Мая чуть занята — очередь подождать не успела. Нажмите отправить ещё раз через несколько секунд.";
}
