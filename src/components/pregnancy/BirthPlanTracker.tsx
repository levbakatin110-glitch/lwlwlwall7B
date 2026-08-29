"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DiaryChip,
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
import { getJournalEntries, useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const JOURNAL = "birth_plan";

const PLAN_ITEMS = [
  "Партнёр в родзале",
  "Эпидуральная — обсудить",
  "Вертикальные роды",
  "Ранний контакт кожа-к-кожа",
  "Отказ от стимуляции без показаний",
] as const;

function entryItem(e: JournalEntry): string {
  return String(e.fields?.item || e.value).trim();
}

export function BirthPlanTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => getJournalEntries(s, JOURNAL));
  const [custom, setCustom] = useState("");

  const sorted = useMemo(
    () =>
      entries
        .map((e) => ({ e, item: entryItem(e), startMs: entryTimeMs(e) }))
        .filter((x) => x.item)
        .sort((a, b) => b.startMs - a.startMs),
    [entries],
  );

  const activeItems = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      const item = entryItem(e);
      if (item) set.add(item.toLowerCase());
    }
    return set;
  }, [entries]);

  const todayCount = useMemo(
    () => entriesForToday(entries).length,
    [entries],
  );

  function isActive(item: string): boolean {
    return activeItems.has(item.toLowerCase());
  }

  function addItem(item: string) {
    if (isActive(item)) return;
    addJournalEntry(JOURNAL, {
      date: todayYmd(),
      value: item,
      note: "",
      fields: { item, startMs: Date.now() },
    });
  }

  function addCustom() {
    const text = custom.trim();
    if (!text || isActive(text)) return;
    addJournalEntry(JOURNAL, {
      date: todayYmd(),
      value: text,
      note: "",
      fields: { item: text, startMs: Date.now() },
    });
    setCustom("");
  }

  return (
    <DiaryPage>
      <DiaryStats
        items={[
          { label: "В плане", value: sorted.length },
          { label: "Сегодня", value: todayCount },
        ]}
      />

      <p className="mt-3 text-center text-xs text-muted">
        PDF и полный план — в{" "}
        <Link href="/med" className="text-accent underline">
          мед. карте
        </Link>
      </p>

      <div className="mt-5 rounded-2xl border border-line bg-card p-4">
        <p className="text-[11px] font-medium text-muted">Пункты плана</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PLAN_ITEMS.map((item) => (
            <DiaryChip
              key={item}
              active={isActive(item)}
              onClick={() => addItem(item)}
            >
              {item}
            </DiaryChip>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCustom();
            }}
            placeholder="Свой пункт…"
            className="min-w-0 flex-1 rounded-xl border border-line bg-background/50 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!custom.trim() || isActive(custom.trim())}
            onClick={addCustom}
            className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {sorted.length > 0 ? (
        <div className="mt-6">
          <DiarySectionTitle left="План" right={`${sorted.length}`} />
          <DiaryTimeline>
            {sorted.map((item, i) => (
              <li key={item.e.id}>
                <DiaryTimelineRow
                  accent={i === 0}
                  left={
                    <span className="text-[11px] tabular-nums text-muted">
                      {formatClock(item.startMs)}
                    </span>
                  }
                  mark="✓"
                  right={
                    <span className="text-sm leading-snug">{item.item}</span>
                  }
                  onClick={() => {
                    if (window.confirm("Убрать из плана?")) {
                      removeJournalEntry(JOURNAL, item.e.id);
                    }
                  }}
                />
              </li>
            ))}
          </DiaryTimeline>
        </div>
      ) : (
        <DiaryEmpty>Нажмите пункт — он попадёт в план</DiaryEmpty>
      )}
    </DiaryPage>
  );
}
