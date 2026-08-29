"use client";

import { useMemo, useState } from "react";
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
import { entryTimeMs, formatClock, todayYmd } from "@/lib/diary-day";
import { getJournalEntries, useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const JOURNAL = "preg_weight";

function entryKg(e: JournalEntry): number {
  const fromField = Number(e.fields?.kg);
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  const m = e.value.match(/([\d]+[.,]?\d*)\s*кг/i);
  return m ? Number(m[1].replace(",", ".")) : 0;
}

function formatKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} кг`;
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  const rounded = Math.round(delta * 10) / 10;
  const s =
    rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${sign}${s} кг`;
}

export function PregWeightTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => getJournalEntries(s, JOURNAL));
  const [kg, setKg] = useState("");

  const sorted = useMemo(
    () =>
      entries
        .map((e) => ({ e, kg: entryKg(e), startMs: entryTimeMs(e) }))
        .filter((x) => x.kg > 0)
        .sort((a, b) => b.startMs - a.startMs),
    [entries],
  );

  const latest = sorted[0];
  const prev = sorted[1];
  const delta =
    latest && prev ? Math.round((latest.kg - prev.kg) * 10) / 10 : null;

  const kgNum = Number(kg.replace(",", "."));
  const canSave = Number.isFinite(kgNum) && kgNum >= 30 && kgNum <= 200;

  function save() {
    if (!canSave) return;
    const rounded = Math.round(kgNum * 10) / 10;
    addJournalEntry(JOURNAL, {
      date: todayYmd(),
      value: formatKg(rounded),
      note: "",
      fields: { kg: rounded, startMs: Date.now() },
    });
    setKg("");
  }

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          {
            label: "Последний вес",
            value: latest ? formatKg(latest.kg) : "—",
          },
          {
            label: "Дельта",
            value: delta != null ? formatDelta(delta) : "—",
          },
          { label: "Записей", value: sorted.length },
        ]}
      />

      <div className="mt-5 flex flex-col items-center rounded-3xl border border-line bg-gradient-to-b from-card to-[color-mix(in_oklab,var(--accent)_6%,var(--card))] py-10 shadow-sm">
        <input
          type="text"
          inputMode="decimal"
          value={kg}
          onChange={(e) => setKg(e.target.value)}
          placeholder="0.0"
          className="w-40 border-0 bg-transparent text-center font-display text-5xl font-semibold tabular-nums tracking-tight text-accent outline-none placeholder:text-muted/30"
        />
        <span className="mt-1 text-sm font-medium text-muted">кг</span>
      </div>

      {sorted.length > 0 ? (
        <div className="mt-6">
          <DiarySectionTitle left="История" right={`${sorted.length}`} />
          <DiaryTimeline>
            {sorted.map((item, i) => (
              <li key={item.e.id}>
                <DiaryTimelineRow
                  accent={i === 0}
                  left={
                    <div>
                      <span className="text-[11px] tabular-nums text-muted">
                        {formatClock(item.startMs)}
                      </span>
                      <p className="text-[10px] text-muted/70">{item.e.date}</p>
                    </div>
                  }
                  mark={
                    <span className="text-xs tabular-nums">
                      {item.kg % 1 === 0
                        ? item.kg.toFixed(0)
                        : item.kg.toFixed(1)}
                    </span>
                  }
                  right={
                    <span className="text-sm tabular-nums text-muted">
                      {formatKg(item.kg)}
                    </span>
                  }
                  onClick={() => {
                    if (window.confirm("Удалить запись?")) {
                      removeJournalEntry(JOURNAL, item.e.id);
                    }
                  }}
                />
              </li>
            ))}
          </DiaryTimeline>
        </div>
      ) : (
        <DiaryEmpty>Взвешивайтесь раз в неделю</DiaryEmpty>
      )}

      <DiaryStickyCta>
        <DiaryPrimaryButton disabled={!canSave} onClick={save}>
          {canSave ? `Сохранить ${formatKg(kgNum)}` : "Сохранить"}
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
