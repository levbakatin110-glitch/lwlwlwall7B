"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DiaryEmpty,
  DiaryPage,
  DiaryPrimaryButton,
  DiarySectionTitle,
  DiaryStats,
  DiaryStickyCta,
  DiaryTimeline,
  DiaryTimelineRow,
} from "@/components/diary/DiaryShell";
import { DiaryInsightCard } from "@/components/diary/DiaryInsightCard";
import { walkInsight } from "@/lib/diary-insights";
import {
  entriesForToday,
  entryTimeMs,
  formatClock,
  formatDuration,
  todayYmd,
} from "@/lib/diary-day";
import { liveParse, liveSet } from "@/lib/live-session";
import { useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const SS_KEY = "maya-walk-session";
const MIN_SEC = 30;

type LiveSession = {
  startMs: number;
  from?: string;
  to?: string;
};

function loadSession(): LiveSession | null {
  return liveParse<LiveSession>(SS_KEY);
}

function entryTotalSec(e: JournalEntry): number {
  const fromField = Number(e.fields?.totalSec);
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  const fromMin = Number(e.fields?.totalMin);
  if (Number.isFinite(fromMin) && fromMin > 0) return fromMin * 60;
  const m = e.value.match(/(\d+)\s*мин/i);
  return m ? Number(m[1]) * 60 : 0;
}

function entryEndMs(e: JournalEntry): number {
  const f = e.fields;
  if (typeof f?.endMs === "number") return f.endMs;
  const start = entryTimeMs(e);
  const dur = entryTotalSec(e);
  return start + dur * 1000;
}

export function WalkTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => s.journals.walk ?? []);
  const [live, setLive] = useState<LiveSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const s = loadSession();
    if (s) {
      setLive(s);
      if (s.from) setFrom(s.from);
      if (s.to) setTo(s.to);
    }
  }, []);

  useEffect(() => {
    try {
      if (!live) liveSet(SS_KEY, null);
      else liveSet(SS_KEY, JSON.stringify(live));
    } catch {
      /* */
    }
  }, [live]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [live]);

  const todayItems = useMemo(() => {
    return entriesForToday(entries)
      .map((e) => ({
        e,
        startMs: entryTimeMs(e),
        endMs: entryEndMs(e),
        totalSec: entryTotalSec(e),
        from: String(e.fields?.from ?? e.fields?.place ?? ""),
        to: String(e.fields?.to ?? ""),
      }))
      .filter((x) => x.totalSec > 0)
      .sort((a, b) => b.startMs - a.startMs);
  }, [entries]);

  const stats = useMemo(() => {
    const totalSec = todayItems.reduce((s, x) => s + x.totalSec, 0);
    const totalMin = Math.round(totalSec / 60);
    const last = todayItems[0];
    return {
      totalMin,
      count: todayItems.length,
      last: last ? formatClock(last.startMs) : "—",
    };
  }, [todayItems]);

  const insight = useMemo(() => walkInsight(entries), [entries]);

  const liveSec = live
    ? Math.max(0, Math.floor((now - live.startMs) / 1000))
    : 0;

  function start() {
    const startMs = Date.now();
    const next: LiveSession = {
      startMs,
      from: from.trim() || undefined,
      to: to.trim() || undefined,
    };
    setLive(next);
    setNow(startMs);
  }

  function stopAndSave() {
    if (!live) return;
    const endMs = Date.now();
    const totalSec = Math.floor((endMs - live.startMs) / 1000);
    if (totalSec < MIN_SEC) {
      liveSet(SS_KEY, null);
      setLive(null);
      return;
    }
    const totalMin = Math.max(1, Math.round(totalSec / 60));
    const fromLabel = (live.from ?? from).trim();
    const toLabel = (live.to ?? to).trim();
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
    liveSet(SS_KEY, null);
    setLive(null);
  }

  const hasData = todayItems.length > 0 || live;

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          { label: "Сегодня минут", value: stats.totalMin },
          { label: "Прогулок", value: stats.count },
          { label: "Последняя", value: stats.last },
        ]}
      />

      <DiaryInsightCard view={insight} />

      {!live ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[11px] text-muted">Откуда</span>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="дом"
              className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[11px] text-muted">Куда</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="парк"
              className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
            />
          </label>
        </div>
      ) : null}

      {hasData ? (
        <div className="mt-5">
          <DiarySectionTitle left="Сегодня" />
          <DiaryTimeline>
            {live ? (
              <li>
                <DiaryTimelineRow
                  accent
                  left={
                    <span className="text-[11px] tabular-nums text-muted">
                      {formatClock(live.startMs)}
                    </span>
                  }
                  mark="…"
                  right={
                    <span className="font-display text-lg font-semibold tabular-nums text-accent">
                      {formatDuration(liveSec)}
                    </span>
                  }
                />
              </li>
            ) : null}
            {todayItems.map((item, i) => {
              const route =
                [item.from, item.to].filter(Boolean).join(" → ") || "—";
              return (
                <li key={item.e.id}>
                  <DiaryTimelineRow
                    accent={i === 0 && !live}
                    left={
                      <span className="text-[11px] tabular-nums text-muted">
                        {formatClock(item.startMs)}
                      </span>
                    }
                    mark={Math.max(1, Math.round(item.totalSec / 60))}
                    right={
                      <span className="text-sm text-muted">{route}</span>
                    }
                    onClick={() => {
                      if (window.confirm("Удалить прогулку?")) {
                        removeJournalEntry("walk", item.e.id);
                      }
                    }}
                  />
                </li>
              );
            })}
          </DiaryTimeline>
        </div>
      ) : (
        <DiaryEmpty>Пока пусто</DiaryEmpty>
      )}

      <DiaryStickyCta>
        {live ? (
          <DiaryPrimaryButton onClick={stopAndSave}>
            <span className="tabular-nums">{formatDuration(liveSec)}</span>
            <span>· Закончить</span>
          </DiaryPrimaryButton>
        ) : (
          <DiaryPrimaryButton onClick={start}>
            Прогулка началась
          </DiaryPrimaryButton>
        )}
      </DiaryStickyCta>
    </DiaryPage>
  );
}
