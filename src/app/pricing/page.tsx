import { Suspense } from "react";
import PricingInner from "./PricingInner";
import { LEGAL_OPERATOR } from "@/lib/legal";

export default function PricingPage() {
  const o = LEGAL_OPERATOR;
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
      <p className="mx-auto max-w-2xl px-4 pb-10 text-[11px] leading-relaxed text-muted">
        {o.shortName} · ИНН {o.inn} · ОГРНИП {o.ogrnip}
        <br />
        {o.address} ·{" "}
        <a className="underline" href={`mailto:${o.email}`}>
          {o.email}
        </a>
      </p>
    </>
  );
}
