"use client";

import Link from "next/link";
import { MayaIcon } from "@/components/icons/MayaIcon";

/** Плавающая кнопка общения мам (desktop). */
export function WhiteNoisePlayer() {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 hidden flex-col items-end gap-2.5 md:flex">
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
