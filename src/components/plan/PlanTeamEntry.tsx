"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { PlanConsultantAvatar } from "@/components/plan/PlanConsultantAvatar";
import { PLAN_CONSULTANT_IDS } from "@/lib/plan-consultants";
import {
  PLAN_CONSULTANT_NAMES,
  PLAN_TEAM_ENTRY_HINT,
  PLAN_TEAM_ENTRY_LABEL,
  PLAN_TEAM_FAB_HINT,
  PLAN_TEAM_FAB_LINE1,
  PLAN_TEAM_FAB_LINE2,
} from "@/lib/plan-products";
import { useAppStore } from "@/lib/store";

type PlanOrderBrief = {
  id: string;
  chatClosedAt?: string;
  status: string;
};

export type PlanTeamEntryState = {
  ready: boolean;
  visible: boolean;
  href: string | null;
};

function isPaidOrder(o: PlanOrderBrief): boolean {
  return o.status !== "awaiting_payment";
}

function isOpenPlanChat(o: PlanOrderBrief): boolean {
  if (!isPaidOrder(o)) return false;
  if (o.status === "closed" || o.status === "completed") return false;
  if (o.status === "accompaniment_active") return true;
  return !o.chatClosedAt;
}

/** Куда вести «План + чат» — только если есть оплаченный заказ */
export function pickPlanTeamTarget(
  orders: PlanOrderBrief[],
): Pick<PlanTeamEntryState, "visible" | "href"> {
  const paid = orders.filter(isPaidOrder);
  if (!paid.length) return { visible: false, href: null };
  const open = paid.find(isOpenPlanChat);
  const target = open ?? paid[0]!;
  return { visible: true, href: `/plan/${target.id}` };
}

export function usePlanTeamEntry(): PlanTeamEntryState {
  const emailVerified = useAppStore((s) => s.emailVerified);
  const [state, setState] = useState<PlanTeamEntryState>({
    ready: false,
    visible: false,
    href: null,
  });

  useEffect(() => {
    if (!emailVerified) {
      setState({ ready: true, visible: false, href: null });
      return;
    }

    let cancelled = false;
    void fetch("/api/plan-orders", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { orders?: PlanOrderBrief[] } | null) => {
        if (cancelled) return;
        const picked = pickPlanTeamTarget(d?.orders ?? []);
        setState({ ready: true, ...picked });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ ready: true, visible: false, href: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [emailVerified]);

  return state;
}

/** @deprecated используйте usePlanTeamEntry */
export function usePlanTeamHref(): string {
  const { href } = usePlanTeamEntry();
  return href ?? "/";
}

const graphiteFab =
  "pointer-events-auto flex h-[3.85rem] w-[3.85rem] flex-col items-center justify-center rounded-full border border-zinc-600/80 bg-gradient-to-b from-zinc-700 to-zinc-900 text-white shadow-[0_8px_28px_rgba(0,0,0,0.35)] ring-2 ring-zinc-500/35 transition hover:from-zinc-600 hover:to-zinc-800";

/** Плавающая кнопка — только у купивших план */
export function PlanTeamFloatingButton() {
  const { ready, visible, href } = usePlanTeamEntry();
  if (!ready || !visible || !href) return null;

  return (
    <Link
      href={href}
      aria-label={PLAN_TEAM_FAB_HINT}
      title={PLAN_TEAM_FAB_HINT}
      className={graphiteFab}
    >
      <MayaIcon name="study" size={20} className="text-zinc-100" />
      <span className="mt-0.5 flex flex-col items-center leading-none">
        <span className="text-[7px] font-bold uppercase tracking-wide text-zinc-200">
          {PLAN_TEAM_FAB_LINE1}
        </span>
        <span className="mt-0.5 text-[7px] font-bold uppercase tracking-wide text-zinc-400">
          {PLAN_TEAM_FAB_LINE2}
        </span>
      </span>
    </Link>
  );
}

const graphiteCarouselIcon =
  "flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-zinc-700 to-zinc-900 text-white shadow-md ring-2 ring-zinc-500/30";

/** Ярлык в карусели шапки — только у купивших план */
export function PlanTeamCarouselLink({ active }: { active: boolean }) {
  const { ready, visible, href } = usePlanTeamEntry();
  if (!ready || !visible || !href) return null;

  return (
    <Link
      href={href}
      title={PLAN_TEAM_ENTRY_HINT}
      aria-label={PLAN_TEAM_ENTRY_LABEL}
      aria-current={active ? "page" : undefined}
      className={`flex w-[3.65rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl px-0.5 py-0.5 transition ${
        active ? "bg-zinc-200/80 dark:bg-zinc-800/50" : "hover:bg-zinc-100/80"
      }`}
    >
      <span className={graphiteCarouselIcon}>
        <MayaIcon name="study" size={16} className="text-zinc-100" />
      </span>
      <span
        className={`w-full truncate text-center text-[8px] font-bold leading-tight tracking-tight ${
          active ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-600"
        }`}
      >
        План
      </span>
    </Link>
  );
}

/** Баннер на пустом чате — только у купивших план */
export function PlanTeamChatBanner() {
  const { ready, visible, href } = usePlanTeamEntry();
  if (!ready || !visible || !href) return null;

  return (
    <Link
      href={href}
      className="mt-3 inline-flex w-full max-w-sm items-center gap-3 rounded-2xl border border-zinc-600/50 bg-gradient-to-br from-zinc-800 to-zinc-950 px-4 py-3.5 text-left text-white shadow-lg ring-1 ring-zinc-500/25 transition hover:from-zinc-700 hover:to-zinc-900"
    >
      <span className="flex shrink-0 -space-x-2">
        {PLAN_CONSULTANT_IDS.map((id) => (
          <PlanConsultantAvatar
            key={id}
            consultantId={id}
            size={28}
            className="ring-2 ring-zinc-800"
          />
        ))}
      </span>
      <span>
        <span className="block text-sm font-semibold">{PLAN_TEAM_ENTRY_LABEL}</span>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-300">
          Живой чат · {PLAN_CONSULTANT_NAMES}
        </span>
      </span>
    </Link>
  );
}
