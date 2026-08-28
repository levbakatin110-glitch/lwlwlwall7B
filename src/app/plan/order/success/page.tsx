"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function SuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("order");
  const [status, setStatus] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/plan-orders/${orderId}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          order?: { status: string; accompanimentPaid?: boolean };
        };
        const st = data.order?.status;
        if (!cancelled && st) setStatus(st);
        if (
          st &&
          st !== "awaiting_payment" &&
          (st !== "closed" || data.order?.accompanimentPaid)
        ) {
          router.replace(`/plan/${orderId}`);
        }
      } catch {
        /* retry */
      }
      if (!cancelled) setTries((t) => t + 1);
    };

    void poll();
    const t = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [orderId, router]);

  if (!orderId) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <p className="text-muted">Заказ не найден</p>
        <Link href="/modules" className="mt-4 text-accent">
          К дневникам
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="h-10 w-10 animate-pulse rounded-full bg-accent-soft" />
      <h1 className="font-display mt-6 text-xl font-semibold">
        Подтверждаем оплату…
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Обычно это несколько секунд. Не закрывайте страницу.
      </p>
      {tries > 12 && status === "awaiting_payment" ? (
        <div className="mt-6 max-w-sm text-sm">
          <p className="text-muted">
            Если оплата прошла, но страница зависла — откройте чат вручную:
          </p>
          <Link
            href={`/plan/${orderId}`}
            className="mt-3 inline-block font-semibold text-accent"
          >
            Открыть чат
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function PlanOrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-muted">
          …
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
