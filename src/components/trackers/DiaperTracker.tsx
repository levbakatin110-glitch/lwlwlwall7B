"use client";

import { useMemo, useState } from "react";
import { MayaIcon, type IconName } from "@/components/icons/MayaIcon";
import { useAppStore } from "@/lib/store";
import {
  DiaryEmpty,
  DiaryPage,
  DiaryStats,
} from "@/components/diary/DiaryShell";
import { DiaryEntryJournal, DIARY_ICON_TONE } from "@/components/diary/DiaryHistory";
import { DiaryInsightCard } from "@/components/diary/DiaryInsightCard";
import { diaperInsight } from "@/lib/diary-insights";
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
    icons: ["drop"] as const,
    tone: "text-sky-800 dark:text-sky-200",
  },
  {
    id: "dirty",
    label: "Грязный",
    icons: ["poop"] as const,
    tone: "text-amber-900 dark:text-amber-200",
  },
  {
    id: "both",
    label: "Оба",
    icons: ["drop", "poop"] as const,
    tone: "text-violet-800 dark:text-violet-200",
  },
  {
    id: "dry",
    label: "Сухой",
    icons: ["check"] as const,
    tone: "text-emerald-800 dark:text-emerald-200",
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
  const birthDate = useAppStore((s) => s.profile?.birthDate);
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

  const insight = useMemo(
    () => diaperInsight(entries, birthDate),
    [entries, birthDate],
  );

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
      <DiaryStats
        items={[
          { label: "сегодня", value: stats.total },
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

      <DiaryInsightCard view={insight} />

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
            ? "Следующая запись, с раздражением"
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
              <span className={`flex items-center gap-1 ${k.tone}`}>
                {k.icons.map((name) => (
                  <MayaIcon key={name} name={name as IconName} size={22} />
                ))}
              </span>
              <p className="mt-1.5 text-sm font-semibold">{k.label}</p>
            </button>
          ))}
        </div>

        {entries.length > 0 ? (
          <DiaryEntryJournal
            entries={entries}
            icon="diaper"
            iconTone={DIARY_ICON_TONE.diaper}
            titleOf={(e) => kindLabel(String(e.fields?.kind || ""))}
            metaOf={(e) => {
              const time = formatClock(entryTimeMs(e));
              return Number(e.fields?.rash) === 1
                ? `${time} · раздражение`
                : time;
            }}
            confirmText="Удалить эту запись из дневника?"
            onRemove={(id) => removeJournalEntry("diaper", id)}
            empty={<DiaryEmpty>Тип смены, в историю</DiaryEmpty>}
          />
        ) : (
          <DiaryEmpty>Тип смены, в историю</DiaryEmpty>
        )}
    </DiaryPage>
  );
}
