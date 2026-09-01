"use client";

import { useMemo, useState } from "react";
import {
  DiaryCoach,
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
import { parseHeightCm, parseWeightKg } from "@/lib/growth-norms";
import { useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const JOURNAL = "growth";

function entryWeight(e: JournalEntry): number | null {
  const w = e.fields?.weightKg;
  if (typeof w === "number" && Number.isFinite(w) && w > 0) return w;
  return parseWeightKg(e.value)?.kg ?? null;
}

function entryHeight(e: JournalEntry): number | null {
  const h = e.fields?.heightCm;
  if (typeof h === "number" && Number.isFinite(h) && h > 0) return h;
  return parseHeightCm(e.value)?.cm ?? null;
}

function formatKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} кг`;
}

function formatCm(cm: number): string {
  const rounded = Math.round(cm * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} см`;
}

function buildValue(weight: number | null, height: number | null): string {
  const parts: string[] = [];
  if (weight != null) parts.push(formatKg(weight));
  if (height != null) parts.push(formatCm(height));
  return parts.join(", ");
}

export function GrowthTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => s.journals[JOURNAL] ?? []);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  const sorted = useMemo(
    () =>
      entries
        .map((e) => ({
          e,
          weightKg: entryWeight(e),
          heightCm: entryHeight(e),
          startMs: entryTimeMs(e),
        }))
        .filter((x) => x.weightKg != null || x.heightCm != null)
        .sort((a, b) => b.startMs - a.startMs),
    [entries],
  );

  const latestWeight = useMemo(() => {
    for (const item of sorted) {
      if (item.weightKg != null) return item.weightKg;
    }
    return null;
  }, [sorted]);

  const latestHeight = useMemo(() => {
    for (const item of sorted) {
      if (item.heightCm != null) return item.heightCm;
    }
    return null;
  }, [sorted]);

  const weightNum = Number(weight.replace(",", "."));
  const heightNum = Number(height.replace(",", "."));
  const hasWeight = Number.isFinite(weightNum) && weightNum >= 1 && weightNum <= 30;
  const hasHeight = Number.isFinite(heightNum) && heightNum >= 40 && heightNum <= 130;
  const canSave = hasWeight || hasHeight;

  function save() {
    if (!canSave) return;
    const startMs = Date.now();
    const w = hasWeight ? Math.round(weightNum * 10) / 10 : null;
    const h = hasHeight ? Math.round(heightNum * 10) / 10 : null;
    const fields: Record<string, string | number> = { startMs };
    if (w != null) fields.weightKg = w;
    if (h != null) fields.heightCm = h;
    addJournalEntry(JOURNAL, {
      date: todayYmd(),
      value: buildValue(w, h),
      note: "",
      fields,
    });
    setWeight("");
    setHeight("");
  }

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          {
            label: "последний вес",
            value: latestWeight != null ? formatKg(latestWeight) : "—",
          },
          {
            label: "последний рост",
            value: latestHeight != null ? formatCm(latestHeight) : "—",
          },
          { label: "записей", value: sorted.length },
        ]}
      />

      <DiaryCoach
        tone={sorted.length >= 2 ? "ok" : "tip"}
        title={
          sorted.length >= 2
            ? "Смотрим тренд, не одну точку"
            : "Вес и рост — якоря для педиатра"
        }
      >
        {sorted.length >= 2
          ? "Две–три точки за месяц важнее «идеальной цифры». Скачок или плато обсуждайте на приёме, не по чужому графику из интернета."
          : "Взвешивайте в одно время, без одежды. Рост — лёжа до года, стоя потом. Нормы ВОЗ — ориентир, не приговор."}
      </DiaryCoach>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center rounded-3xl border border-line bg-gradient-to-b from-card to-[color-mix(in_oklab,var(--accent)_6%,var(--card))] py-8 shadow-sm">
          <input
            type="text"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0.0"
            className="w-full border-0 bg-transparent text-center font-display text-4xl font-semibold tabular-nums tracking-tight text-accent outline-none placeholder:text-muted/30"
          />
          <span className="mt-1 text-sm font-medium text-muted">кг</span>
        </div>
        <div className="flex flex-col items-center rounded-3xl border border-line bg-gradient-to-b from-card to-[color-mix(in_oklab,var(--accent)_6%,var(--card))] py-8 shadow-sm">
          <input
            type="text"
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="0"
            className="w-full border-0 bg-transparent text-center font-display text-4xl font-semibold tabular-nums tracking-tight text-accent outline-none placeholder:text-muted/30"
          />
          <span className="mt-1 text-sm font-medium text-muted">см</span>
        </div>
      </div>

      {sorted.length > 0 ? (
        <div className="mt-6">
          <DiarySectionTitle left="История" right={`${sorted.length}`} />
          <DiaryTimeline>
            {sorted.map((item, i) => (
              <li key={item.e.id}>
                <DiaryTimelineRow
                  accent={i === 0}
                  mark={
                    item.weightKg != null ? (
                      <span className="text-[10px] tabular-nums">
                        {item.weightKg % 1 === 0
                          ? item.weightKg.toFixed(0)
                          : item.weightKg.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[10px] tabular-nums">
                        {item.heightCm}
                      </span>
                    )
                  }
                  left={
                    <div>
                      <span className="text-[11px] tabular-nums text-muted">
                        {formatClock(item.startMs)}
                      </span>
                      <p className="text-[10px] text-muted/70">{item.e.date}</p>
                    </div>
                  }
                  right={
                    <span className="text-sm tabular-nums text-muted">
                      {buildValue(item.weightKg, item.heightCm)}
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
        <DiaryEmpty>Запишите вес, рост или оба</DiaryEmpty>
      )}

      <DiaryStickyCta>
        <DiaryPrimaryButton disabled={!canSave} onClick={save}>
          Сохранить
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
