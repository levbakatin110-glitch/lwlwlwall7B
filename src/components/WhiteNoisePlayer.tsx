"use client";

import Link from "next/link";
import { MayaIcon } from "@/components/icons/MayaIcon";

/** Плавающая кнопка общения мам (desktop). */
export function WhiteNoisePlayer() {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 hidden flex-col items-end gap-2.5 md:flex">
      <Link
        href="/community"
        aria-label="Круг мам"
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-card/95 text-foreground shadow-[0_12px_32px_-16px_rgba(40,16,24,0.45)] backdrop-blur-xl transition hover:border-accent/40 hover:bg-accent-soft"
      >
        <MayaIcon name="circle" size={22} className="text-accent" />
      </Link>
    </div>
  );
}
