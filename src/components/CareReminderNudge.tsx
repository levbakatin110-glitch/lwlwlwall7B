"use client";

import Link from "next/link";
import type { CareReminderKind } from "@/lib/care-reminders";
import { getCareReminders, useAppStore } from "@/lib/store";

const KIND_MAP: Partial<Record<string, CareReminderKind>> = {
  breastfeeding: "feed",
  formula: "feed",
  solids: "feed",
  sleep: "sleep",
  diaper: "diaper",
  walk: "walk",
  water: "water",
  preg_meds: "meds",
};

export function CareReminderNudge({ moduleId }: { moduleId: string }) {
  const kind = KIND_MAP[moduleId];
  const childSpaces = useAppStore((s) => s.childSpaces);
  const activeChildId = useAppStore((s) => s.activeChildId);
  if (!kind) return null;
  const on = getCareReminders({ childSpaces, activeChildId }).some(
    (r) => r.kind === kind && r.enabled,
  );
  if (on) return null;
  return (
    <Link
      href="/reminders"
      className="mt-3 block rounded-2xl border border-dashed border-accent/35 bg-accent-soft/40 px-3.5 py-2.5 text-sm"
    >
      <span className="font-semibold text-accent">Напоминания</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-muted">
        Мая может писать на телефон по расписанию — кормление, сон, подгузник.
      </span>
    </Link>
  );
}
