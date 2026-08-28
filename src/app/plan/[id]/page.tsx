"use client";

import Link from "next/link";
import { use } from "react";
import { SpecialistChat } from "@/components/plan/PlanOffer";

export default function PlanOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2 md:hidden">
        <Link href="/modules" className="text-sm text-accent">
          ← Дневники
        </Link>
      </header>
      <SpecialistChat orderId={id} />
    </div>
  );
}
