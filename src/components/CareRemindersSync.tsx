"use client";

import { useEffect, useRef } from "react";
import {
  computeNextAt,
  ctaCopyForKind,
  lastLogMs,
  LOG_MODULES,
  nextTimesAt,
  pickUsageCtas,
  sanitizeReminder,
  USAGE_DAY_AT,
  USAGE_EVENING_AT,
  type ScheduledPushItem,
} from "@/lib/care-reminders";
import { childDisplayName } from "@/lib/children";
import { useAppStore } from "@/lib/store";

const FIRED_KEY = "maya-reminders-fired-v1";

function alreadyFired(id: string): boolean {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as string[]).includes(id);
  } catch {
    return false;
  }
}

function withName(text: string, name: string): string {
  const n = name.trim();
  if (!n || n === "Малыш") return text;
  return text.replace(/малыша/gi, n).replace(/малыш/gi, n);
}

export function collectScheduledPushes(now = Date.now()): ScheduledPushItem[] {
  const s = useAppStore.getState();
  const tz = new Date().getTimezoneOffset();
  const items: ScheduledPushItem[] = [];

  for (const [childId, space] of Object.entries(s.childSpaces ?? {})) {
    const child = s.children.find((c) => c.id === childId);
    const name = childDisplayName(child);
    const journals = {
      ...(space.journals ?? {}),
      ...(s.momJournals ?? {}),
    };
    const reminders = (space.careReminders ?? [])
      .map(sanitizeReminder)
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    const enabled = space.enabledModules ?? [];
    for (const r of reminders) {
      if (!r.enabled) continue;
      const last = lastLogMs(journals, LOG_MODULES[r.kind] ?? []);
      const needsLog = r.resetOnLog || r.kind === "feed" || r.kind === "sleep";
      if (needsLog && !last) continue;
      const nextAt = computeNextAt(r, now, tz, last);
      const cta = ctaCopyForKind(r.kind, journals, enabled);
      const titleBase = cta?.title ?? r.title;
      const title =
        s.children.length > 1 ? `${titleBase} · ${name}` : titleBase;
      items.push({
        id: `${childId}:${r.id}`,
        title,
        body: withName(cta?.body ?? r.body, name),
        url: cta?.href ?? r.href ?? "/",
        tag: `${childId}:${r.id}`,
        nextAt,
        mode: r.mode,
        intervalMin: r.intervalMin,
        times: r.times,
        quietFrom: r.quietFrom,
        quietTo: r.quietTo,
        tzOffsetMin: tz,
      });
    }
    const usage = pickUsageCtas(journals, reminders);
    const usageSlots = [
      usage.day
        ? {
            id: `${childId}:usage-day`,
            cta: usage.day,
            at: USAGE_DAY_AT,
          }
        : null,
      usage.evening
        ? {
            id: `${childId}:usage-evening`,
            cta: usage.evening,
            at: USAGE_EVENING_AT,
          }
        : null,
    ].filter((row): row is NonNullable<typeof row> => Boolean(row));
    for (const slot of usageSlots) {
      items.push({
        id: slot.id,
        title:
          s.children.length > 1 ? `${slot.cta.title} · ${name}` : slot.cta.title,
        body: withName(slot.cta.body, name),
        url: slot.cta.href,
        tag: slot.id,
        nextAt: nextTimesAt(now, [slot.at], tz, "21:00", "08:00"),
        mode: "times",
        times: [slot.at],
        quietFrom: "21:00",
        quietTo: "08:00",
        tzOffsetMin: tz,
      });
    }
  }

  const oneShotMods: { id: string; href: string }[] = [
    { id: "preg_meds", href: "/m/preg_meds" },
  ];
  for (const mod of oneShotMods) {
    const list =
      mod.id === "preg_meds"
        ? (s.momJournals?.preg_meds ?? s.journals?.preg_meds ?? [])
        : (s.journals?.[mod.id] ?? []);
    for (const e of list) {
      if (e.fields?.taken) continue;
      const at = String(e.fields?.remindAt || "");
      const t = new Date(at).getTime();
      if (!Number.isFinite(t)) continue;
      if (t < now - 2 * 60 * 60 * 1000) continue;
      if (t > now + 30 * 24 * 60 * 60 * 1000) continue;
      const sid = `once:${mod.id}:${e.id}`;
      if (alreadyFired(`${mod.href}-${e.id}`)) continue;
      const text = String(e.fields?.text || e.note || e.value || "Напоминание");
      items.push({
        id: sid,
        title: "Мая · напоминание",
        body: text.slice(0, 200),
        url: mod.href,
        tag: sid,
        nextAt: t,
        mode: "once",
        tzOffsetMin: tz,
      });
    }
  }

  return items.slice(0, 60);
}

export function flushCareSchedule() {
  const items = collectScheduledPushes();
  return fetch("/api/push/schedule", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  }).catch(() => undefined);
}

/** Шлёт расписание на сервер, пуши придут, даже если вкладка закрыта. */
export function CareRemindersSync() {
  const emailVerified = useAppStore((s) => s.emailVerified);
  const childSpaces = useAppStore((s) => s.childSpaces);
  const momJournals = useAppStore((s) => s.momJournals);
  const journals = useAppStore((s) => s.journals);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!emailVerified) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void flushCareSchedule();
    }, 400);
    const onReady = () => {
      void flushCareSchedule();
    };
    window.addEventListener("maya-push-ready", onReady);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      window.removeEventListener("maya-push-ready", onReady);
    };
  }, [emailVerified, childSpaces, momJournals, journals]);

  return null;
}
