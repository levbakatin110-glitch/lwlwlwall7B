"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MayaIcon } from "@/components/icons/MayaIcon";

type PlanOrderBrief = {
  id: string;
  chatClosedAt?: string;
  status: string;
};

export function usePlanTeamHref(): string {
  const [href, setHref] = useState("/modules");

  useEffect(() => {
    void fetch("/api/plan-orders", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { orders?: PlanOrderBrief[] } | null) => {
        const orders = d?.orders ?? [];
        const open = orders.find(
          (o) => !o.chatClosedAt || o.status === "accompaniment_active",
        );
        const latest = orders[0];
        const id = open?.id ?? latest?.id;
        if (id) setHref(`/plan/${id}`);
      })
      .catch(() => {});
  }, []);

  return href;
}

const graphiteFab =
  "pointer-events-auto flex h-14 w-14 flex-col items-center justify-center rounded-full border border-zinc-600/80 bg-gradient-to-b from-zinc-700 to-zinc-900 text-white shadow-[0_8px_28px_rgba(0,0,0,0.35)] ring-2 ring-zinc-500/35 transition hover:from-zinc-600 hover:to-zinc-800";

/** Плавающая кнопка «Команда Маи» — графит, над чатом мам */
export function PlanTeamFloatingButton() {
  const href = usePlanTeamHref();
  return (
    <Link
      href={href}
      aria-label="Команда Маи — разбор дневника"
      title="Команда Маи"
      className={graphiteFab}
    >
      <MayaIcon name="health" size={20} className="text-zinc-100" />
      <span className="mt-0.5 text-[8px] font-bold uppercase leading-none tracking-wide text-zinc-300">
        команда
      </span>
    </Link>
  );
}

const graphiteCarouselIcon =
  "flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-zinc-700 to-zinc-900 text-white shadow-md ring-2 ring-zinc-500/30";

/** Ярлык в карусели шапки */
export function PlanTeamCarouselLink({
  active,
}: {
  active: boolean;
}) {
  const href = usePlanTeamHref();
  return (
    <Link
      href={href}
      title="Команда Маи"
      aria-label="Команда Маи"
      aria-current={active ? "page" : undefined}
      className={`flex w-[3.65rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl px-0.5 py-0.5 transition ${
        active ? "bg-zinc-200/80 dark:bg-zinc-800/50" : "hover:bg-zinc-100/80"
      }`}
    >
      <span className={graphiteCarouselIcon}>
        <MayaIcon name="health" size={16} />
      </span>
      <span
        className={`w-full truncate text-center text-[9px] font-bold leading-tight tracking-tight ${
          active ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-600"
        }`}
      >
        Команда
      </span>
    </Link>
  );
}

/** Баннер на пустом чате с Маей */
export function PlanTeamChatBanner() {
  const href = usePlanTeamHref();
  return (
    <Link
      href={href}
      className="mt-3 inline-flex w-full max-w-sm items-center gap-3 rounded-2xl border border-zinc-600/50 bg-gradient-to-br from-zinc-800 to-zinc-950 px-4 py-3.5 text-left text-white shadow-lg ring-1 ring-zinc-500/25 transition hover:from-zinc-700 hover:to-zinc-900"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
        <MayaIcon name="health" size={22} className="text-zinc-100" />
      </span>
      <span>
        <span className="block text-sm font-semibold">Команда Маи</span>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-300">
          Разбор дневника · чат с командой (не врач)
        </span>
      </span>
    </Link>
  );
}
