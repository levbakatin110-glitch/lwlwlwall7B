import { formatDuration, todayYmd } from "@/lib/diary-day";
import {
  LIVE_KEYS,
  liveParse,
  liveSet,
  sleepLiveKey,
} from "@/lib/live-session";
import { localToday } from "@/lib/local-date";
import { formatSec } from "@/lib/pregnancy";
import type { JournalEntry } from "@/lib/types";

export type SleepLive = { kind: "nap" | "night"; startedAt: number };
export type WalkLive = { startMs: number; from?: string; to?: string };
export type BfLive = {
  leftSec: number;
  rightSec: number;
  active: "left" | "right" | null;
  tickAt: number | null;
};
export type ContractionLive = { startMs: number };

export type CustomTimerLive = {
  moduleId: string;
  startedAt: number;
  title: string;
};

export type IslandKind =
  | "sleep"
  | "preg_sleep"
  | "walk"
  | "bf"
  | "contractions"
  | "timer";

export type IslandTarget = {
  id: IslandKind;
  title: string;
  href: string;
  startedAt: number;
  elapsedOffsetSec: number;
  paused?: boolean;
};

type AddEntry = (
  journalId: string,
  entry: Omit<JournalEntry, "id" | "createdAt">,
) => void;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function settleBf(s: BfLive, now = Date.now()): BfLive {
  if (!s.active || !s.tickAt) return s;
  const add = Math.max(0, Math.floor((now - s.tickAt) / 1000));
  if (add <= 0) return s;
  return {
    ...s,
    leftSec: s.active === "left" ? s.leftSec + add : s.leftSec,
    rightSec: s.active === "right" ? s.rightSec + add : s.rightSec,
    tickAt: now,
  };
}

export function islandElapsedSec(t: IslandTarget, now = Date.now()): number {
  return (
    t.elapsedOffsetSec + Math.max(0, Math.floor((now - t.startedAt) / 1000))
  );
}

/** Что сейчас засечено — одно, самое срочное. */
export function readIslandTarget(now = Date.now()): IslandTarget | null {
  const contraction = liveParse<ContractionLive>(LIVE_KEYS.contractions);
  if (contraction?.startMs) {
    return {
      id: "contractions",
      title: "Схватка",
      href: "/m/contractions",
      startedAt: contraction.startMs,
      elapsedOffsetSec: 0,
    };
  }

  const bf = liveParse<BfLive>(LIVE_KEYS.bf);
  if (bf && (bf.active || bf.leftSec + bf.rightSec > 0)) {
    const running = Boolean(bf.active && bf.tickAt);
    return {
      id: "bf",
      title: bf.active === "left" ? "ГВ · левая" : bf.active === "right" ? "ГВ · правая" : "ГВ",
      href: "/m/breastfeeding",
      startedAt: running && bf.tickAt ? bf.tickAt : now,
      elapsedOffsetSec: bf.leftSec + bf.rightSec,
      paused: !running,
    };
  }

  const sleep = liveParse<SleepLive>(sleepLiveKey("sleep"));
  if (sleep?.startedAt) {
    return {
      id: "sleep",
      title: sleep.kind === "night" ? "Ночной сон" : "Дневной сон",
      href: "/m/sleep",
      startedAt: sleep.startedAt,
      elapsedOffsetSec: 0,
    };
  }

  const mom = liveParse<SleepLive>(sleepLiveKey("preg_sleep"));
  if (mom?.startedAt) {
    return {
      id: "preg_sleep",
      title: "Отдых мамы",
      href: "/m/preg_sleep",
      startedAt: mom.startedAt,
      elapsedOffsetSec: 0,
    };
  }

  const walk = liveParse<WalkLive>(LIVE_KEYS.walk);
  if (walk?.startMs) {
    return {
      id: "walk",
      title: "Прогулка",
      href: "/m/walk",
      startedAt: walk.startMs,
      elapsedOffsetSec: 0,
    };
  }

  const custom = liveParse<CustomTimerLive>(LIVE_KEYS.customTimer);
  if (custom?.startedAt && custom.moduleId) {
    return {
      id: "timer",
      title: custom.title || "Таймер",
      href: `/m/${custom.moduleId}`,
      startedAt: custom.startedAt,
      elapsedOffsetSec: 0,
    };
  }

  return null;
}

export function stopSleepLive(
  journalId: "sleep" | "preg_sleep",
  addJournalEntry: AddEntry,
): boolean {
  const key = sleepLiveKey(journalId);
  const live = liveParse<SleepLive>(key);
  if (!live) return false;
  const elapsed = Math.max(0, Math.floor((Date.now() - live.startedAt) / 1000));
  if (elapsed < 15) {
    persist(key, null);
    return true;
  }
  const startDate = new Date(live.startedAt);
  const endDate = new Date();
  const range = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}–${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
  const isMom = journalId === "preg_sleep";
  const label =
    live.kind === "night" ? "ночь" : isMom ? "дневной отдых" : "дневной сон";
  addJournalEntry(journalId, {
    date: todayYmd(),
    value: `${label} ${range} · ${formatDuration(elapsed)}`,
    note: "",
    fields: {
      kind: live.kind,
      totalSec: elapsed,
      from: startDate.toISOString(),
      to: endDate.toISOString(),
      startMs: live.startedAt,
      endMs: endDate.getTime(),
    },
  });
  persist(key, null);
  return true;
}

export function stopWalkLive(addJournalEntry: AddEntry): boolean {
  const live = liveParse<WalkLive>(LIVE_KEYS.walk);
  if (!live) return false;
  const endMs = Date.now();
  const totalSec = Math.floor((endMs - live.startMs) / 1000);
  if (totalSec < 30) {
    persist(LIVE_KEYS.walk, null);
    return true;
  }
  const totalMin = Math.max(1, Math.round(totalSec / 60));
  const fromLabel = (live.from ?? "").trim();
  const toLabel = (live.to ?? "").trim();
  const parts = [`${totalMin} мин`];
  if (fromLabel) parts.push(fromLabel);
  if (toLabel && toLabel !== fromLabel) parts.push(`→ ${toLabel}`);
  addJournalEntry("walk", {
    date: todayYmd(),
    value: parts.join(" · "),
    note: "",
    fields: {
      totalSec,
      startMs: live.startMs,
      endMs,
      ...(fromLabel ? { from: fromLabel } : {}),
      ...(toLabel ? { to: toLabel } : {}),
    },
  });
  persist(LIVE_KEYS.walk, null);
  return true;
}

export function pauseBfLive(): boolean {
  const raw = liveParse<BfLive>(LIVE_KEYS.bf);
  if (!raw?.active) return false;
  const settled = settleBf(raw);
  persist(
    LIVE_KEYS.bf,
    JSON.stringify({ ...settled, active: null, tickAt: null }),
  );
  return true;
}

export function resumeBfLive(): boolean {
  const raw = liveParse<BfLive>(LIVE_KEYS.bf);
  if (!raw || raw.active) return false;
  const side =
    raw.rightSec > raw.leftSec
      ? "right"
      : raw.leftSec > 0
        ? "left"
        : "left";
  persist(
    LIVE_KEYS.bf,
    JSON.stringify({ ...raw, active: side, tickAt: Date.now() }),
  );
  return true;
}

export function saveBfLive(addJournalEntry: AddEntry): boolean {
  const raw = liveParse<BfLive>(LIVE_KEYS.bf);
  if (!raw) return false;
  const settled = settleBf(raw);
  const L = settled.leftSec;
  const R = settled.rightSec;
  const sum = L + R;
  persist(LIVE_KEYS.bf, null);
  if (sum < 5) return true;
  const endMs = Date.now();
  const startMs = endMs - sum * 1000;
  const parts: string[] = [];
  if (L > 0) parts.push(`левая ${formatDuration(L)}`);
  if (R > 0) parts.push(`правая ${formatDuration(R)}`);
  parts.push(`всего ${formatDuration(sum)}`);
  addJournalEntry("breastfeeding", {
    date: new Date().toISOString().slice(0, 10),
    value: parts.join(" · "),
    note: "",
    fields: {
      side: L >= R ? "left" : "right",
      leftSec: L,
      rightSec: R,
      totalSec: sum,
      startMs,
      endMs,
    },
  });
  return true;
}

export function stopContractionLive(addJournalEntry: AddEntry): boolean {
  const live = liveParse<ContractionLive>(LIVE_KEYS.contractions);
  if (!live?.startMs) return false;
  const endMs = Date.now();
  const durationSec = Math.max(1, Math.floor((endMs - live.startMs) / 1000));
  addJournalEntry("contractions", {
    date: localToday(),
    value: `${formatSec(durationSec)} · сила 3/5`,
    note: "",
    fields: {
      durationSec,
      intensity: 3,
      startMs: live.startMs,
      endMs,
    },
  });
  persist(LIVE_KEYS.contractions, null);
  return true;
}

export function applyIslandPause(addJournalEntry: AddEntry): void {
  const t = readIslandTarget();
  if (!t) return;
  if (t.id === "bf") {
    pauseBfLive();
    return;
  }
  applyIslandStop(addJournalEntry);
}

export function startCustomTimerLive(input: CustomTimerLive) {
  persist(LIVE_KEYS.customTimer, JSON.stringify(input));
}

export function stopCustomTimerLive(addJournalEntry: AddEntry): boolean {
  const live = liveParse<CustomTimerLive>(LIVE_KEYS.customTimer);
  if (!live?.startedAt) return false;
  const elapsed = Math.max(0, Math.floor((Date.now() - live.startedAt) / 1000));
  persist(LIVE_KEYS.customTimer, null);
  if (elapsed < 5) return true;
  const mins = Math.max(1, Math.round(elapsed / 60));
  addJournalEntry(live.moduleId, {
    date: todayYmd(),
    value: `${live.title || "Занятие"} · ${mins} мин`,
    note: "",
    fields: { minutes: mins, startMs: live.startedAt, totalSec: elapsed },
  });
  return true;
}

export function applyIslandStop(addJournalEntry: AddEntry): void {
  const t = readIslandTarget();
  if (!t) return;
  if (t.id === "sleep" || t.id === "preg_sleep") {
    stopSleepLive(t.id, addJournalEntry);
    return;
  }
  if (t.id === "walk") {
    stopWalkLive(addJournalEntry);
    return;
  }
  if (t.id === "bf") {
    saveBfLive(addJournalEntry);
    return;
  }
  if (t.id === "timer") {
    stopCustomTimerLive(addJournalEntry);
    return;
  }
  stopContractionLive(addJournalEntry);
}

export function applyIslandResume(): void {
  resumeBfLive();
}

export const ISLAND_EVENT = "maya-island-changed";

export function notifyIslandChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ISLAND_EVENT));
}

function persist(key: string, value: string | null) {
  liveSet(key, value);
  notifyIslandChanged();
}
