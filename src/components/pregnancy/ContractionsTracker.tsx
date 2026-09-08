"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DiaryEmpty,
  DiaryHourStrip,
  DiaryPage,
  DiaryPrimaryButton,
  DiarySectionTitle,
  DiaryStats,
  DiaryStickyCta,
  DiaryTimeline,
  DiaryTimelineRow,
} from "@/components/diary/DiaryShell";
import { localToday } from "@/lib/local-date";
import { breathGuide } from "@/lib/contraction-breath";
import { formatSec } from "@/lib/pregnancy";
import { liveGet, liveSet } from "@/lib/live-session";
import { ISLAND_EVENT, notifyIslandChanged } from "@/lib/live-timer-actions";
import { timerIsland } from "@/lib/timer-island";
import { getJournalEntries, useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

type LiveRow = { startMs: number };

const SESSION_KEY = "maya-contractions-session";

type TimelineItem = {
  id: string;
  startMs: number;
  endMs: number;
  durationSec: number;
  intervalSec: number | null;
  intensity: number | null;
  number: number;
};

function entryStartMs(e: JournalEntry): number {
  const f = e.fields;
  if (typeof f?.startMs === "number") return f.startMs;
  if (typeof f?.endMs === "number" && typeof f?.durationSec === "number") {
    return f.endMs - f.durationSec * 1000;
  }
  if (e.createdAt) {
    const t = Date.parse(e.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(`${e.date}T12:00:00`);
}

function entryEndMs(e: JournalEntry): number {
  const f = e.fields;
  if (typeof f?.endMs === "number") return f.endMs;
  if (typeof f?.durationSec === "number") {
    return entryStartMs(e) + f.durationSec * 1000;
  }
  return entryStartMs(e);
}

function entryDurationSec(e: JournalEntry): number {
  const f = e.fields;
  if (typeof f?.durationSec === "number") return f.durationSec;
  return Math.max(1, Math.floor((entryEndMs(e) - entryStartMs(e)) / 1000));
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildTimeline(entries: JournalEntry[]): TimelineItem[] {
  const today = localToday();
  const day = entries
    .filter((e) => e.date === today)
    .map((e) => ({
      id: e.id,
      startMs: entryStartMs(e),
      endMs: entryEndMs(e),
      durationSec: entryDurationSec(e),
      intensity:
        typeof e.fields?.intensity === "number" ? e.fields.intensity : null,
    }))
    .sort((a, b) => a.startMs - b.startMs);

  return day
    .map((item, i) => {
      const prev = i > 0 ? day[i - 1] : null;
      const intervalSec = prev
        ? Math.max(0, Math.floor((item.startMs - prev.startMs) / 1000))
        : null;
      return {
        ...item,
        intervalSec,
        number: i + 1,
      };
    })
    .reverse();
}

export function ContractionsTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => getJournalEntries(s, "contractions"));
  const [live, setLive] = useState<LiveRow | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const pull = () => {
      try {
        const raw = liveGet(SESSION_KEY);
        const parsed = raw ? (JSON.parse(raw) as LiveRow) : null;
        const next = parsed?.startMs ? parsed : null;
        setLive((prev) =>
          JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
        );
      } catch {
        /* */
      }
    };
    pull();
    window.addEventListener(ISLAND_EVENT, pull);
    return () => window.removeEventListener(ISLAND_EVENT, pull);
  }, []);

  useEffect(() => {
    try {
      if (!live) liveSet(SESSION_KEY, null);
      else liveSet(SESSION_KEY, JSON.stringify(live));
      notifyIslandChanged();
    } catch {
      /* */
    }
  }, [live]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 80);
    return () => window.clearInterval(id);
  }, [live]);

  const timeline = useMemo(() => buildTimeline(entries), [entries]);
  const chronological = useMemo(
    () => [...timeline].reverse(),
    [timeline],
  );

  const liveElapsedMs = live ? Math.max(0, now - live.startMs) : 0;
  const liveDurationSec = Math.floor(liveElapsedMs / 1000);

  const stats = useMemo(() => {
    const hourAgo = now - 60 * 60 * 1000;
    const inHour = chronological.filter((t) => t.startMs >= hourAgo).length;
    const durations = chronological.map((t) => t.durationSec);
    const intervals = chronological
      .map((t) => t.intervalSec)
      .filter((x): x is number => x != null && x > 0);
    const avgDur =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
    const avgInt =
      intervals.length > 0
        ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
        : 0;
    return { inHour, avgDur, avgInt };
  }, [chronological, now]);

  const breath = breathGuide(liveElapsedMs);

  function start() {
    const startMs = Date.now();
    try {
      liveSet(SESSION_KEY, JSON.stringify({ startMs }));
    } catch {
      /* */
    }
    setLive({ startMs });
    setNow(startMs);
    timerIsland.begin({
      id: "contractions",
      title: "Схватка",
      href: "/m/contractions",
      startedAt: startMs,
      elapsedOffsetSec: 0,
    });
    notifyIslandChanged();
  }

  function stopAndSave() {
    if (!live) return;
    const endMs = Date.now();
    const startMs = live.startMs;
    const dur = Math.max(1, Math.floor((endMs - startMs) / 1000));
    const prevStart = chronological.at(-1)?.startMs ?? null;
    const interval =
      prevStart != null
        ? Math.max(0, Math.floor((startMs - prevStart) / 1000))
        : null;
    const value =
      interval != null
        ? `${formatSec(dur)} · интервал ${formatSec(interval)}`
        : formatSec(dur);
    addJournalEntry("contractions", {
      date: localToday(),
      value,
      note: "",
      fields: {
        durationSec: dur,
        ...(interval != null ? { intervalSec: interval } : {}),
        startMs,
        endMs,
        intensity: 3,
      },
    });
    setLive(null);
    timerIsland.sync(null);
  }

  function cancel() {
    setLive(null);
    timerIsland.sync(null);
  }

  const hourSpans = chronological
    .filter((t) => t.startMs >= now - 60 * 60 * 1000)
    .map((t) => ({ startMs: t.startMs, endMs: t.endMs }));
  if (live) {
    hourSpans.push({ startMs: live.startMs, endMs: now });
  }

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          { label: "за час", value: stats.inHour, hint: "схваток" },
          { label: "длит.", value: formatSec(stats.avgDur) },
          {
            label: "интервал",
            value: stats.avgInt > 0 ? formatSec(stats.avgInt) : "—",
          },
        ]}
      />

      <DiaryHourStrip now={now} spans={hourSpans} />

      {live ? (
        <div className="overflow-hidden rounded-[1.5rem] border border-accent/40 bg-gradient-to-b from-accent-soft via-card to-card px-4 py-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Волна идёт
          </p>
          <p className="font-display mt-2 text-6xl font-semibold tabular-nums tracking-tight text-accent">
            {formatSec(liveDurationSec)}
          </p>
          <div className="mx-auto mt-4 h-3 max-w-xs overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(0, Math.min(100, breath.progress * 100))}%` }}
            />
          </div>
          <p className="mt-4 font-display text-2xl font-semibold">{breath.title}</p>
          <p className="mt-1 text-sm text-muted">{breath.hint}</p>
        </div>
      ) : null}

      {timeline.length === 0 && !live ? (
        <DiaryEmpty>
          Нажмите, когда волна началась. Ещё раз, когда отпустит — запись
          сохранится.
        </DiaryEmpty>
      ) : (
        <div>
          <DiarySectionTitle left="Сегодня" right={`${timeline.length}`} />
          <DiaryTimeline>
            {live ? (
              <li>
                <DiaryTimelineRow
                  accent
                  mark={timeline.length + 1}
                  left={
                    <div>
                      <p className="text-[11px] tabular-nums text-muted">
                        сейчас · с {formatClock(live.startMs)}
                      </p>
                      <p className="font-display text-lg font-semibold tabular-nums text-accent">
                        {formatSec(liveDurationSec)}
                      </p>
                    </div>
                  }
                  right={<span className="text-xs text-muted">идёт</span>}
                />
              </li>
            ) : null}
            {timeline.map((item) => (
              <li key={item.id}>
                <DiaryTimelineRow
                  mark={item.number}
                  left={
                    <div>
                      <p className="text-[11px] tabular-nums text-muted">
                        {formatClock(item.startMs)}
                        {item.intervalSec != null
                          ? ` · через ${formatSec(item.intervalSec)}`
                          : ""}
                      </p>
                      <p className="font-display text-lg font-semibold tabular-nums">
                        {formatSec(item.durationSec)}
                      </p>
                    </div>
                  }
                  right={
                    <div className="text-right">
                      {item.intensity != null ? (
                        <p className="text-sm font-semibold">
                          сила {item.intensity}/5
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm("Удалить эту схватку из дневника?")
                          ) {
                            removeJournalEntry("contractions", item.id);
                          }
                        }}
                        className="text-xs text-muted hover:text-foreground"
                      >
                        Удалить
                      </button>
                    </div>
                  }
                />
              </li>
            ))}
          </DiaryTimeline>
        </div>
      )}

      <DiaryStickyCta>
        {live ? (
          <div className="flex gap-2">
            <DiaryPrimaryButton onClick={stopAndSave}>
              <span className="tabular-nums">{formatSec(liveDurationSec)}</span>
              <span>· закончилась</span>
            </DiaryPrimaryButton>
            <button
              type="button"
              onClick={cancel}
              className="shrink-0 rounded-2xl border border-line bg-background px-4 py-3.5 text-sm font-medium text-muted"
            >
              Отмена
            </button>
          </div>
        ) : (
          <DiaryPrimaryButton onClick={start}>Схватка началась</DiaryPrimaryButton>
        )}
        <p className="text-center text-[11px] text-muted">
          Не замена врачу. Воды, кровь, сильная боль, меньше шевелений, скорая /
          роддом.
        </p>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
