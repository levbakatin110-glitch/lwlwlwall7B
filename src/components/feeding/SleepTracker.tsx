"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DiaryDayStrip,
  DiaryEmpty,
  DiaryPage,
  DiaryPrimaryButton,
  DiaryStats,
  DiaryStickyCta,
} from "@/components/diary/DiaryShell";
import {
  DIARY_ICON_TONE,
  DiaryDayHeading,
  DiaryEventCard,
  DiaryGap,
} from "@/components/diary/DiaryHistory";
import { DiaryInsightCard } from "@/components/diary/DiaryInsightCard";
import { ageMonths } from "@/lib/growth-norms";
import { sleepInsight, sleepNormHint } from "@/lib/diary-insights";
import {
  dateCaptionRu,
  entriesForToday,
  formatClock,
  formatDuration,
  formatGap,
  formatHumanDuration,
  wakeMinutesSince,
} from "@/lib/diary-day";
import {
  buildSleepDays,
  sleepBarDays,
  sleepDurationSec,
  sleepEndMs,
  sleepPeriodTotals,
  sleepStartMs,
  type SleepKind,
} from "@/lib/sleep-day";
import { liveGet, liveSet } from "@/lib/live-session";
import { ISLAND_EVENT, notifyIslandChanged } from "@/lib/live-timer-actions";
import { timerIsland } from "@/lib/timer-island";
import { useAppStore } from "@/lib/store";

type Kind = SleepKind;

type SleepLive = {
  kind: Kind;
  startedAt: number;
};

const KEY = "maya-sleep-session";

function kindTitle(kind: string | undefined, isMom: boolean, live?: boolean): string {
  const night = kind === "night";
  const base = night
    ? isMom
      ? "Ночной отдых"
      : "Ночной сон"
    : isMom
      ? "Дневной отдых"
      : "Дневной сон";
  return live ? `${base} · идёт` : base;
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
  const [period, setPeriod] = useState<7 | 14>(7);

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
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [live]);

  const elapsed = useMemo(() => {
    if (!live) return 0;
    return Math.max(0, Math.floor((now - live.startedAt) / 1000));
  }, [live, now]);

  const days = useMemo(
    () => buildSleepDays(entries, now, live, 10),
    [entries, now, live],
  );

  const todayEntries = useMemo(() => {
    return entriesForToday(entries)
      .slice()
      .sort((a, b) => sleepEndMs(b) - sleepEndMs(a));
  }, [entries]);

  const wakeMin = useMemo(() => wakeMinutesSince(entries), [entries]);
  const wakeLabel = wakeMin != null ? `${wakeMin} мин` : "—";

  const bars = useMemo(
    () => sleepBarDays(entries, now, live, period),
    [entries, now, live, period],
  );
  const totals = useMemo(() => sleepPeriodTotals(bars), [bars]);
  const months = isMomSleep ? null : ageMonths(birthDate);
  const norm = sleepNormHint(
    totals.avgSleepSec / 3600,
    months,
    totals.daysWithSleep,
  );

  const insight = useMemo(
    () => sleepInsight(entries, isMomSleep ? null : birthDate, now, period),
    [isMomSleep, entries, birthDate, now, period],
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

  const hasJournal = days.some((d) => d.rows.length > 0);

  return (
    <DiaryPage stickyPad>
      <div className="mb-3 flex justify-center">
        <div className="inline-flex rounded-full border border-line bg-card/70 p-0.5">
          {([7, 14] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPeriod(n)}
              className={`rounded-full px-3.5 py-1 text-[12px] font-semibold ${
                period === n ? "bg-accent-soft text-accent" : "text-muted"
              }`}
            >
              {n} дней
            </button>
          ))}
        </div>
      </div>

      {insight ? <DiaryInsightCard view={insight} /> : null}

      <div className="mt-3">
      <DiaryStats
        items={[
          {
            label: "В среднем / сутки",
            value:
              totals.avgSleepSec > 0
                ? formatHumanDuration(totals.avgSleepSec)
                : "—",
            hint: norm.label,
            hintTone: norm.tone,
          },
          {
            label: "Ночной сон",
            value:
              totals.avgNightSec > 0
                ? formatHumanDuration(totals.avgNightSec)
                : "—",
            hint: `${period} дн.`,
          },
          {
            label: "Дневной сон",
            value:
              totals.avgNapSec > 0
                ? formatHumanDuration(totals.avgNapSec)
                : "—",
            hint:
              totals.avgNapCount > 0
                ? `${String(totals.avgNapCount).replace(".", ",")} сна`
                : "за период",
          },
          {
            label: "Бодрствование",
            value:
              totals.avgWakeSec > 0
                ? formatHumanDuration(totals.avgWakeSec)
                : wakeLabel,
            hint:
              wakeMin != null
                ? `сейчас ${wakeMin} мин`
                : "среднее ВБ",
          },
        ]}
      />
      </div>

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

      {hasJournal ? (
        <div className="mt-2">
          {days.map((day) => {
            if (!day.rows.length) return null;
            const rows = [...day.rows].reverse();
            return (
              <section key={day.ymd} className="mt-6 first:mt-1">
                <DiaryDayHeading
                  label={day.label}
                  date={dateCaptionRu(day.ymd)}
                />
                {rows.map((row) => {
                  if (row.type === "wake") {
                    const label = formatGap(row.startMs, row.endMs);
                    return (
                      <DiaryGap
                        key={`w-${row.startMs}-${row.endMs}`}
                        label={row.current ? `${label} · сейчас` : label}
                      />
                    );
                  }
                  const s = row.span;
                  const dur = formatHumanDuration(sleepDurationSec(s));
                  const meta = s.live
                    ? `${dur}, с ${formatClock(s.startMs)}`
                    : `${dur}, с ${formatClock(s.startMs)} до ${formatClock(s.endMs)}`;
                  return (
                    <DiaryEventCard
                      key={s.id}
                      icon="sleep"
                      tone={DIARY_ICON_TONE.sleep}
                      accent={Boolean(s.live)}
                      title={kindTitle(s.kind, isMomSleep, s.live)}
                      meta={meta}
                      onClick={
                        s.live
                          ? undefined
                          : () => {
                              if (
                                window.confirm(
                                  isMomSleep
                                    ? "Удалить эту запись об отдыхе?"
                                    : "Удалить эту запись о сне?",
                                )
                              ) {
                                removeJournalEntry(journalId, s.id);
                              }
                            }
                      }
                    />
                  );
                })}
              </section>
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
