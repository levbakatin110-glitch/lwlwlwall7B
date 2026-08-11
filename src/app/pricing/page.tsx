"use client";

import { Suspense } from "react";
import PricingInner from "./PricingInner";

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-muted">
          Загрузка…
        </div>
      }
    >
      <PricingInner />
    </Suspense>
  );
}
