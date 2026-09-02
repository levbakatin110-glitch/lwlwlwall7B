import { claimDuePushes } from "@/lib/push-schedule";
import { pushConfigured, sendPushToEmail } from "@/lib/push-send";

const g = globalThis as typeof globalThis & {
  __mayaPushTick?: ReturnType<typeof setInterval>;
};

export async function runPushTick(): Promise<{ due: number; sent: number }> {
  if (!pushConfigured()) return { due: 0, sent: 0 };
  const due = claimDuePushes();
  let sent = 0;
  for (const item of due) {
    const r = await sendPushToEmail(item.email, {
      title: item.title,
      body: item.body,
      url: item.url,
      tag: item.tag,
    });
    sent += r.sent;
  }
  return { due: due.length, sent };
}

export function startPushTickLoop(): void {
  if (g.__mayaPushTick) return;
  if (process.env.NEXT_PHASE) return;
  const tick = () => {
    void runPushTick().catch((e) => {
      console.error("[push-tick]", e);
    });
  };
  const interval = setInterval(tick, 60_000);
  interval.unref();
  g.__mayaPushTick = interval;
  const boot = setTimeout(tick, 12_000);
  boot.unref();
}
