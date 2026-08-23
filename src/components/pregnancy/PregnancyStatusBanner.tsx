"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pregnancyAgeLabel } from "@/lib/pregnancy";
import { useAppStore } from "@/lib/store";

/** Плашка срока беременности — как у конкурентов, в стиле Маи */
export function PregnancyStatusBanner() {
  const pregnancy = useAppStore((s) => s.pregnancy);
  const pathname = usePathname();

  if (!pregnancy?.active || !pregnancy.dueDate) return null;
  if (pathname === "/med" || pathname.startsWith("/legal")) return null;

  const age = pregnancyAgeLabel(pregnancy.dueDate, pregnancy.lmpDate);
  if (!age) return null;

  return (
    <Link
      href="/med"
      className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-full border border-accent/30 bg-accent-soft/70 px-3 py-1.5 text-xs font-medium text-foreground"
    >
      <span>
        Моя беременность{" "}
        <span className="font-semibold text-accent">{age}</span>
      </span>
      <span className="text-accent">Мед. карта →</span>
    </Link>
  );
}
