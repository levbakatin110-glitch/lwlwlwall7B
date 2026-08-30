"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

/** Продажа консультантов отключена — тихо на тарифы. */
function CheckoutInner() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pricing");
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted">
      Мая…
    </div>
  );
}

export default function PlanOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted">
          Мая…
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
