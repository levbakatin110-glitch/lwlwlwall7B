"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

/** Продажа консультантов отключена — редирект на Premium. */
function CheckoutInner() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pricing");
  }, [router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted">
      Услуга консультанта больше не продаётся. Доступен только{" "}
      <Link href="/pricing" className="font-medium text-accent underline">
        Maya Premium
      </Link>
      .
    </div>
  );
}

export default function PlanOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-16 text-center text-sm text-muted">…</div>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
