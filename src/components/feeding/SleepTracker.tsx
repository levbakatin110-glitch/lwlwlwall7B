"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DiaryDayStrip,
  DiaryEmpty,
  DiaryPage,
  DiaryPrimaryButton,
  DiarySectionTitle,
  DiarySpreadLog,
  DiaryStats,
  DiaryStickyCta,
  DiaryTimeline,
  DiaryTimelineRow,
} from "@/components/diary/DiaryShell";
import { DiaryInsightCard } from "@/components/diary/DiaryInsightCard";
import { sleepInsight } from "@/lib/diary-insights";
import { formatClock, formatDuration } from "@/lib/diary-day";
import {
  buildSleepDays,
  currentWakeMs,
  collectSleepSpans,
  sleepDurationSec,
  type SleepKind,
} from "@/lib/sleep-day";
import { liveGet, liveSet } from "@/lib/live-session";
import { ISLAND_EVENT, notifyIslandChanged } from "@/lib/live-timer-actions";
import { timerIsland } from "@/lib/timer-island";
import { useAppStore } from "@/lib/store";

type SleepLive = {
  kind: SleepKind;
  startedAt: number;
};

const KEY = "maya-sleep-session";

function kindLabel(kind: string | undefined, isMom: boolean): string {
  if (kind === "night") return "ночной";
  return isMom ? "дневной отдых" : "дневной";
}

export function SleepTracker({ journalId = "sleep" }: { journalId?: string }) {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => s.journals[journalId] ?? []);
  const birthDate = useAppStore((s) => s.profile?.birthDate);

  const storageKey = journalId === "sleep" ? KEY : `${KEY}-${journalId}`;
  const isMomSleep = journalId === "preg_sleep";

  const [live, setLive] = useState<SleepLive | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const pull = () => {
      try {
        const raw = liveGet(storageKey);
        const next = raw ? (JSON.parse(raw) as SleepLive) : null;
        setLive((prev) =>
          JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
        );
      } catch {
        setLive(null);
      }
    };
    pull();
    window.addEventListener(ISLAND_EVENT, pull);
    return () => window.removeEventListener(ISLAND_EVENT, pull);
  }, [storageKey]);

  useEffect(() => {
    try {
      if (!live) liveSet(storageKey, null);
      else liveSet(storageKey, JSON.stringify(live));
      notifyIslandChanged();
    } catch {
      /* */
    }
  }, [live, storageKey]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), live ? 500 : 15_000);
    return () => window.clearInterval(id);
  }, [live]);

  const elapsed = useMemo(() => {
    if (!live) return 0;
    return Math.max(0, Math.floor((now - live.startedAt) / 1000));
  }, [live, now]);

  const days = useMemo(
    () => buildSleepDays(entries, now, live),
    [entries, now, live],
  );
  const today = days[0];
  const spans = useMemo(
    () => collectSleepSpans(entries, live, now),
    [entries, live, now],
  );
  const wakeMs = currentWakeMs(spans, now);

  const insight = useMemo(
    () => (isMomSleep ? null : sleepInsight(entries, birthDate, now)),
    [isMomSleep, entries, birthDate, now],
  );

  const sleepSpans = useMemo(
    () => spans.map((s) => ({ startMs: s.startMs, endMs: s.endMs })),
    [spans],
  );

  function start(kind: SleepKind) {
    const startedAt = Date.now();
    const next = { kind, startedAt };
    try {
      liveSet(storageKey, JSON.stringify(next));
    } catch {
      /* */
    }
    setLive(next);
    setNow(startedAt);
    timerIsland.begin({
      id: isMomSleep ? "preg_sleep" : "sleep",
      title:
        kind === "night"
          ? isMomSleep
            ? "Ночной отдых"
            : "Ночной сон"
          : isMomSleep
            ? "Отдых мамы"
            : "Дневной сон",
      href: isMomSleep ? "/m/preg_sleep" : "/m/sleep",
      startedAt,
      elapsedOffsetSec: 0,
    });
    notifyIslandChanged();
  }

  function stop() {
    if (!live) return;
    if (elapsed < 15) {
      setLive(null);
      return;
    }
    const startDate = new Date(live.startedAt);
    const endDate = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const range = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}–${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
    const label = live.kind === "night" ? "ночь" : isMomSleep ? "дневной отдых" : "дневной сон";
    addJournalEntry(journalId, {
      date: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`,
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
    setLive(null);
  }

  const hasTimeline = days.some((d) => d.rows.length > 0) || live;

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          {
            label: "Сон за сутки",
            value: today && today.sleepSec > 0 ? formatDuration(today.sleepSec) : "—",
          },
          {
            label: "Ночной",
            value: today && today.nightSec > 0 ? formatDuration(today.nightSec) : "—",
          },
          {
            label: "Бодрств.",
            value: live
              ? "спит"
              : wakeMs != null
                ? formatDuration(Math.floor(wakeMs / 1000))
                : "—",
          },
        ]}
      />

      {insight ? <DiaryInsightCard view={insight} /> : null}

      <DiaryDayStrip now={now} spans={sleepSpans} />

      {live ? (
        <div className="mt-2 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            {live.kind === "night" ? "Ночной" : isMomSleep ? "Отдых" : "Дневной"}
          </p>
          <p className="font-mono mt-2 text-5xl font-semibold tabular-nums tracking-tight">
            {formatDuration(elapsed)}
          </p>
        </div>
      ) : null}

      {hasTimeline ? (
        <div className="mt-2 flex flex-col gap-5">
          {days.map((day) => {
            if (!day.rows.length && day.sleepSec <= 0) return null;
            const sleepMarks = day.rows.filter((r) => r.type === "sleep");
            return (
              <div key={day.ymd}>
                <DiarySectionTitle
                  left={day.label}
                  right={
                    day.sleepSec > 0
                      ? `${formatDuration(day.sleepSec)} сна · ${formatDuration(day.wakeSec)} бодрств.`
                      : undefined
                  }
                />
                <DiaryTimeline>
                  {day.rows.map((row) => {
                    if (row.type === "wake") {
                      return (
                        <li key={`wake-${row.startMs}`}>
                          <DiaryTimelineRow
                            mark="б"
                            left={
                              <DiarySpreadLog
                                time={`${formatClock(row.startMs)}–${formatClock(row.endMs)}`}
                                value={formatDuration(
                                  sleepDurationSec(row),
                                )}
                                detail="бодрствование"
                                accent={row.current}
                              />
                            }
                          />
                        </li>
                      );
                    }
                    const { span } = row;
                    const mark = sleepMarks.findIndex((r) => r.span.id === span.id) + 1;
                    return (
                      <li key={span.id}>
                        <DiaryTimelineRow
                          accent={Boolean(span.live)}
                          mark={span.live ? "…" : mark}
                          onClick={
                            span.live
                              ? undefined
                              : () => {
                                  if (
                                    window.confirm(
                                      isMomSleep
                                        ? "Удалить эту запись об отдыхе?"
                                        : "Удалить эту запись о сне?",
                                    )
                                  ) {
                                    removeJournalEntry(journalId, span.id);
                                  }
                                }
                          }
                          left={
                            <DiarySpreadLog
                              accent={Boolean(span.live)}
                              time={`${formatClock(span.startMs)}–${
                                span.live ? "…" : formatClock(span.endMs)
                              }`}
                              value={formatDuration(sleepDurationSec(span))}
                              detail={kindLabel(span.kind, isMomSleep)}
                            />
                          }
                        />
                      </li>
                    );
                  })}
                </DiaryTimeline>
              </div>
            );
          })}
        </div>
      ) : (
        <DiaryEmpty>Пока пусто</DiaryEmpty>
      )}

      <DiaryStickyCta>
        {live ? (
          <div className="flex gap-2">
            <DiaryPrimaryButton onClick={stop}>
              <span className="tabular-nums">{formatDuration(elapsed)}</span>
              <span>· {isMomSleep ? "Проснулась" : "Проснулся"} · сохранить</span>
            </DiaryPrimaryButton>
            <button
              type="button"
              onClick={() => setLive(null)}
              className="shrink-0 rounded-2xl border border-line bg-card px-4 py-4 text-sm font-medium text-muted"
            >
              ×
            </button>
          </div>
        ) : (
          <>
            <DiaryPrimaryButton onClick={() => start("nap")}>
              {isMomSleep ? "Дневной отдых" : "Дневной сон"}
            </DiaryPrimaryButton>
            <button
              type="button"
              onClick={() => start("night")}
              className="w-full rounded-2xl border border-line bg-card px-5 py-3.5 text-sm font-semibold text-foreground transition active:scale-[0.98]"
            >
              Ночной
            </button>
          </>
        )}
      </DiaryStickyCta>
    </DiaryPage>
  );
}
