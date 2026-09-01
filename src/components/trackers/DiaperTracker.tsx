"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import {
  DiaryCoach,
  DiaryEmpty,
  DiaryPage,
  DiarySectionTitle,
  DiaryStats,
  DiaryTimeline,
  DiaryTimelineRow,
} from "@/components/diary/DiaryShell";
import {
  entriesForToday,
  entryTimeMs,
  formatClock,
  todayYmd,
} from "@/lib/diary-day";

const KINDS = [
  {
    id: "wet",
    label: "Мокрый",
    emoji: "💧",
    tone: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  },
  {
    id: "dirty",
    label: "Грязный",
    emoji: "💩",
    tone: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  },
  {
    id: "both",
    label: "Оба",
    emoji: "💧💩",
    tone: "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  },
  {
    id: "dry",
    label: "Сухой",
    emoji: "✓",
    tone: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  },
] as const;

type KindId = (typeof KINDS)[number]["id"];

function kindLabel(id: string): string {
  return KINDS.find((k) => k.id === id)?.label ?? id;
}

export function DiaperTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => s.journals.diaper ?? []);
  const [rashNext, setRashNext] = useState(false);
  const [flashKind, setFlashKind] = useState<KindId | null>(null);

  const todayEntries = useMemo(
    () =>
      [...entriesForToday(entries)].sort(
        (a, b) => entryTimeMs(b) - entryTimeMs(a),
      ),
    [entries],
  );

  const stats = useMemo(() => {
    let wet = 0;
    let dirty = 0;
    for (const e of todayEntries) {
      const k = String(e.fields?.kind || "");
      if (k === "wet" || k === "both") wet++;
      if (k === "dirty" || k === "both") dirty++;
    }
    return { total: todayEntries.length, wet, dirty };
  }, [todayEntries]);

  const lastMs = todayEntries[0] ? entryTimeMs(todayEntries[0]) : null;
  const minsSince =
    lastMs != null ? Math.max(0, Math.floor((Date.now() - lastMs) / 60_000)) : null;
  const diaperCoach =
    stats.wet < 3 && todayEntries.length >= 4
      ? {
          tone: "watch" as const,
          title: "Мокрых маловато",
          body: "За день обычно ждут хотя бы 5–6 мокрых. Если малыш вялый или мало писает — это повод написать педиатру, не ждать «на всякий случай».",
        }
      : minsSince != null && minsSince > 180 && stats.total > 0
        ? {
            tone: "tip" as const,
            title: "Давно не меняли",
            body: `Последняя смена ${minsSince} мин назад. Даже «сухой» чекин помогает увидеть, не слишком ли редко.`,
          }
        : {
            tone: "tip" as const,
            title: "Один тап — и в истории",
            body: "Мокрый / грязный / оба / сухой. Если краснеет попа — включите «раздражение» перед сменой. Это потом видно в ленте.",
          };

  function log(kind: KindId) {
    const meta = KINDS.find((k) => k.id === kind)!;
    const parts: string[] = [meta.label];
    if (rashNext) parts.push("раздражение");
    addJournalEntry("diaper", {
      date: todayYmd(),
      value: parts.join(" · "),
      note: "",
      fields: {
        kind,
        rash: rashNext ? 1 : 0,
        startMs: Date.now(),
      },
    });
    setRashNext(false);
    setFlashKind(kind);
    window.setTimeout(() => setFlashKind(null), 600);
  }

  return (
    <DiaryPage>
      <div className="maya-rise overflow-hidden rounded-[1.5rem] border border-line bg-card/80 p-4 sm:p-5">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Смена подгузника
        </h2>

        <div className="mt-4">
          <DiaryStats
            items={[
              { label: "сегодня всего", value: stats.total },
              { label: "мокрых", value: stats.wet },
              {
                label: "с последней",
                value:
                  minsSince == null
                    ? "—"
                    : minsSince >= 60
                      ? `${Math.floor(minsSince / 60)} ч`
                      : `${minsSince} мин`,
              },
            ]}
          />
        </div>

        <DiaryCoach tone={diaperCoach.tone} title={diaperCoach.title}>
          {diaperCoach.body}
        </DiaryCoach>

        <button
          type="button"
          onClick={() => setRashNext((v) => !v)}
          className={`mt-4 w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
            rashNext
              ? "border-blush/40 bg-blush-soft text-foreground"
              : "border-line text-muted hover:border-accent/25"
          }`}
        >
          {rashNext
            ? "Следующая запись — с раздражением"
            : "Отметить раздражение на следующую смену"}
        </button>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => log(k.id)}
              className={`rounded-2xl border px-3 py-4 text-left transition active:scale-[0.97] ${
                flashKind === k.id
                  ? "border-accent bg-accent-soft ring-2 ring-accent/30"
                  : "border-line bg-card/50 hover:border-accent/25"
              }`}
            >
              <p className="text-lg leading-none">{k.emoji}</p>
              <p className="mt-1.5 text-sm font-semibold">{k.label}</p>
            </button>
          ))}
        </div>

        {todayEntries.length > 0 ? (
          <div className="mt-5">
            <DiarySectionTitle left="Сегодня" right={String(stats.total)} />
            <DiaryTimeline>
              {todayEntries.map((e, i) => {
                const k = String(e.fields?.kind || "");
                const hasRash = Number(e.fields?.rash) === 1;
                return (
                  <li key={e.id}>
                    <DiaryTimelineRow
                      mark={todayEntries.length - i}
                      accent={i === 0}
                      onClick={() => {
                        if (
                          window.confirm("Удалить эту запись из дневника?")
                        ) {
                          removeJournalEntry("diaper", e.id);
                        }
                      }}
                      left={
                        <div>
                          <p className="text-sm font-medium">{kindLabel(k)}</p>
                          <p className="text-[10px] tabular-nums text-muted/70">
                            {formatClock(entryTimeMs(e))}
                          </p>
                        </div>
                      }
                      right={
                        hasRash ? (
                          <p className="text-sm font-medium text-blush">
                            раздражение
                          </p>
                        ) : (
                          <p className="text-sm text-muted/40">—</p>
                        )
                      }
                    />
                  </li>
                );
              })}
            </DiaryTimeline>
          </div>
        ) : (
          <DiaryEmpty>
            Тапните тип смены. История за сегодня появится здесь.
          </DiaryEmpty>
        )}
      </div>
    </DiaryPage>
  );
}
