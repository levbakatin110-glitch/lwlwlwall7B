"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import type { PaidPlanId } from "@/lib/subscription";

/** Подтягивает Premium с сервера после оплаты Prodamus */
export function SubscriptionSync() {
  const email = useAppStore((s) => s.accountEmail);
  const emailVerified = useAppStore((s) => s.emailVerified);
  const activateSubscription = useAppStore((s) => s.activateSubscription);
  const subscription = useAppStore((s) => s.subscription);

  useEffect(() => {
    if (!emailVerified || !email) return;
    let cancelled = false;

    async function sync() {
      try {
        const res = await fetch(
          `/api/subscription/status?email=${encodeURIComponent(email!)}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          active?: boolean;
          planId?: string;
          expiresAt?: string | null;
        };
        if (!data.active || !data.planId || data.planId === "free") return;
        if (
          subscription.planId === data.planId &&
          subscription.expiresAt === data.expiresAt
        ) {
          return;
        }
        // активируем локально тем же planId (срок пересчитается;
        // ниже подставим expiresAt с сервера)
        activateSubscription(data.planId as PaidPlanId);
        if (data.expiresAt) {
          useAppStore.setState({
            subscription: {
              planId: data.planId as PaidPlanId,
              expiresAt: data.expiresAt,
            },
          });
        }
      } catch {
        // ignore
      }
    }

    void sync();
    const t = window.setInterval(() => void sync(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [
    email,
    emailVerified,
    activateSubscription,
    subscription.planId,
    subscription.expiresAt,
  ]);

  return null;
}
