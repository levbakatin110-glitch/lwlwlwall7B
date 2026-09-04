"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DiaryDayStrip,
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
import { sleepInsight } from "@/lib/diary-insights";
import {
  entriesForToday,
  entryTimeMs,
  formatClock,
  formatDuration,
  wakeMinutesSince,
} from "@/lib/diary-day";
import { liveGet, liveSet } from "@/lib/live-session";
import { useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

type Kind = "nap" | "night";

type SleepLive = {
  kind: Kind;
  startedAt: number;
};

const KEY = "maya-sleep-session";

function sleepStartMs(e: JournalEntry): number {
  if (typeof e.fields?.startMs === "number") return e.fields.startMs;
  if (typeof e.fields?.from === "string") {
    const t = Date.parse(e.fields.from);
    if (!Number.isNaN(t)) return t;
  }
  return entryTimeMs(e);
}

function sleepEndMs(e: JournalEntry): number {
  if (typeof e.fields?.endMs === "number") return e.fields.endMs;
  if (typeof e.fields?.to === "string") {
    const t = Date.parse(e.fields.to);
    if (!Number.isNaN(t)) return t;
  }
  const sec = Number(e.fields?.totalSec);
  if (Number.isFinite(sec)) return sleepStartMs(e) + sec * 1000;
  return sleepStartMs(e);
}

function sleepDurationSec(e: JournalEntry): number {
  const sec = Number(e.fields?.totalSec);
  if (Number.isFinite(sec)) return sec;
  return Math.max(0, Math.floor((sleepEndMs(e) - sleepStartMs(e)) / 1000));
}

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
    try {
      const raw = liveGet(storageKey);
      setLive(raw ? (JSON.parse(raw) as SleepLive) : null);
    } catch {
      setLive(null);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      if (!live) liveSet(storageKey, null);
      else liveSet(storageKey, JSON.stringify(live));
    } catch {
      /* */
    }
  }, [live, storageKey]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [live]);

  const elapsed = useMemo(() => {
    if (!live) return 0;
    return Math.max(0, Math.floor((now - live.startedAt) / 1000));
  }, [live, now]);

  const todayEntries = useMemo(() => {
    return entriesForToday(entries)
      .slice()
      .sort((a, b) => sleepEndMs(b) - sleepEndMs(a));
  }, [entries]);

  const stats = useMemo(() => {
    const totalSec = todayEntries.reduce((s, e) => s + sleepDurationSec(e), 0);
    const wake = wakeMinutesSince(entries);
    return {
      totalSec,
      count: todayEntries.length,
      wakeLabel: wake != null ? `${wake} мин` : "—",
      wakeMin: wake,
    };
  }, [todayEntries, entries]);

  const insight = useMemo(
    () => (isMomSleep ? null : sleepInsight(entries, birthDate)),
    [isMomSleep, entries, birthDate],
  );

  const sleepSpans = useMemo(() => {
    const spans = todayEntries.map((e) => ({
      startMs: sleepStartMs(e),
      endMs: sleepEndMs(e),
    }));
    if (live) {
      spans.push({ startMs: live.startedAt, endMs: now });
    }
    return spans;
  }, [todayEntries, live, now]);

  function start(kind: Kind) {
    setLive({ kind, startedAt: Date.now() });
    setNow(Date.now());
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

  const hasTimeline = todayEntries.length > 0 || live;

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          {
            label: "Сегодня",
            value: stats.totalSec > 0 ? formatDuration(stats.totalSec) : "—",
          },
          { label: "Снов", value: stats.count },
          { label: "Бодрств.", value: stats.wakeLabel },
        ]}
      />

      {insight ? <DiaryInsightCard view={insight} /> : null}

      <DiaryDayStrip now={now} spans={sleepSpans} />

      {live ? (
        <div className="mt-6 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            {live.kind === "night" ? "Ночной" : isMomSleep ? "Отдых" : "Дневной"}
          </p>
          <p className="font-mono mt-2 text-5xl font-semibold tabular-nums tracking-tight">
            {formatDuration(elapsed)}
          </p>
        </div>
      ) : null}

      {hasTimeline ? (
        <div className="mt-5">
          <DiarySectionTitle left="Время" right="Тип" />
          <DiaryTimeline>
            {live ? (
              <li>
                <DiaryTimelineRow
                  accent
                  mark={todayEntries.length + 1}
                  left={
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[11px] tabular-nums text-muted">
                        {formatClock(live.startedAt)}–…
                      </span>
                      <span className="font-display text-lg font-semibold tabular-nums text-accent">
                        {formatDuration(elapsed)}
                      </span>
                    </div>
                  }
                  right={
                    <span className="text-sm font-medium">
                      {kindLabel(live.kind, isMomSleep)}
                    </span>
                  }
                />
              </li>
            ) : null}
            {todayEntries.map((e, i) => {
              const startMs = sleepStartMs(e);
              const endMs = sleepEndMs(e);
              const dur = sleepDurationSec(e);
              const isNewest = i === 0 && !live;
              return (
                <li key={e.id}>
                  <DiaryTimelineRow
                    accent={isNewest}
                    mark={todayEntries.length - i}
                    onClick={() => {
                      if (
                        window.confirm(
                          isMomSleep
                            ? "Удалить эту запись об отдыхе?"
                            : "Удалить эту запись о сне?",
                        )
                      ) {
                        removeJournalEntry(journalId, e.id);
                      }
                    }}
                    left={
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[11px] tabular-nums text-muted">
                          {formatClock(startMs)}–{formatClock(endMs)}
                        </span>
                        <span
                          className={`font-display text-lg font-semibold tabular-nums ${
                            isNewest ? "text-accent" : "text-foreground"
                          }`}
                        >
                          {formatDuration(dur)}
                        </span>
                      </div>
                    }
                    right={
                      <span className="text-sm font-medium">
                        {kindLabel(
                          typeof e.fields?.kind === "string"
                            ? e.fields.kind
                            : undefined,
                          isMomSleep,
                        )}
                      </span>
                    }
                  />
                </li>
              );
            })}
          </DiaryTimeline>
        </div>
      ) : (
        <DiaryEmpty>
          {isMomSleep
            ? "Засеките отдых — даже короткий. Полоска суток покажет дырки."
            : "Засеките сон. Полоска суток — как у Huckleberry, только без подписки."}
        </DiaryEmpty>
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
