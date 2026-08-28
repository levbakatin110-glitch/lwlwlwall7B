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
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-card/70 px-4 py-2.5">
        <Link
          href="/"
          className="text-sm font-semibold text-accent transition hover:underline"
        >
          ← К Мае
        </Link>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          Команда
        </span>
        <Link
          href="/modules"
          className="text-sm text-muted transition hover:text-foreground"
        >
          Дневники
        </Link>
      </header>
      <SpecialistChat orderId={id} />
    </div>
  );
}
