import webpush from "web-push";
import {
  listPushForEmail,
  removePushSubscription,
  vapidPrivateKey,
  vapidPublicKey,
  vapidSubject,
  type PushSubscriptionJSON,
} from "@/lib/push-store";

function configured(): boolean {
  return Boolean(vapidPublicKey() && vapidPrivateKey());
}

function applyVapid() {
  if (!configured()) return false;
  webpush.setVapidDetails(vapidSubject(), vapidPublicKey(), vapidPrivateKey());
  return true;
}

export function pushConfigured(): boolean {
  return configured();
}

export async function sendWebPush(
  sub: PushSubscriptionJSON,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<"ok" | "gone" | "error"> {
  if (!applyVapid()) return "error";
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return "error";
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || "/",
        tag: payload.tag || "maya",
      }),
      { TTL: 60 * 60 * 12, urgency: "high" },
    );
    return "ok";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      removePushSubscription(sub.endpoint);
      return "gone";
    }
    return "error";
  }
}

export async function sendPushToEmail(
  email: string,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<{ sent: number; gone: number }> {
  const subs = listPushForEmail(email);
  let sent = 0;
  let gone = 0;
  for (const sub of subs) {
    const r = await sendWebPush(sub, payload);
    if (r === "ok") sent += 1;
    if (r === "gone") gone += 1;
  }
  return { sent, gone };
}
