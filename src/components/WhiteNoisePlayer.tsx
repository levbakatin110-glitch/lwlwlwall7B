"use client";

import Link from "next/link";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { PlanTeamFloatingButton } from "@/components/plan/PlanTeamEntry";

/** Плавающие кнопки: Мария (графит) + общение мам */
export function WhiteNoisePlayer() {
  return (
    <div className="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-end gap-2.5 md:bottom-5 md:right-5">
      <PlanTeamFloatingButton />
      <Link
        href="/community"
        aria-label="Общение — чат с другими в Мае"
        title="Общение"
        className="pointer-events-auto flex h-14 w-14 flex-col items-center justify-center rounded-full border border-line bg-card/95 text-foreground shadow-lg backdrop-blur-xl transition hover:border-accent/40 hover:bg-accent-soft"
      >
        <MayaIcon name="circle" size={20} className="text-accent" />
        <span className="mt-0.5 text-[9px] font-semibold leading-none text-muted">
          чат
        </span>
      </Link>
    </div>
  );
}
