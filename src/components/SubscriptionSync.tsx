"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import type { PaidPlanId } from "@/lib/subscription";

/** Подтягивает Premium с сервера после оплаты Prodamus */
export function SubscriptionSync() {
  const email = useAppStore((s) => s.accountEmail);
  const emailVerified = useAppStore((s) => s.emailVerified);
  const activateSubscription = useAppStore((s) => s.activateSubscription);
  const clearSubscription = useAppStore((s) => s.clearSubscription);

  useEffect(() => {
    if (!emailVerified || !email) return;
    let cancelled = false;

    async function sync() {
      try {
        const res = await fetch("/api/subscription/status", {
          credentials: "include",
        });
        if (cancelled) return;
        if (res.status === 401) return;
        if (!res.ok) return;
        const data = (await res.json()) as {
          active?: boolean;
          planId?: string;
          expiresAt?: string | null;
        };
        const local = useAppStore.getState().subscription;
        if (!data.active || !data.planId || data.planId === "free") {
          if (local.planId !== "free") clearSubscription();
          return;
        }
        if (
          local.planId === data.planId &&
          local.expiresAt === data.expiresAt
        ) {
          return;
        }
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
  }, [email, emailVerified, activateSubscription, clearSubscription]);

  return null;
}
