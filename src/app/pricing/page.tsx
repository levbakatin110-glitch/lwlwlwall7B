import { Suspense } from "react";
import Link from "next/link";
import PricingInner from "./PricingInner";

export default function PricingPage() {
  return (
    <>
      <Suspense
        fallback={
          <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-muted">
            Загрузка…
          </div>
        }
      >
        <PricingInner />
      </Suspense>
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 pb-12 pt-2">
        <div
          className="h-px w-16 bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--accent)_55%,transparent)] to-transparent"
          aria-hidden
        />
        <Link
          href="/legal"
          className="text-[11px] tracking-wide text-muted/70 transition hover:text-muted"
        >
          Документы
        </Link>
      </div>
    </>
  );
}
