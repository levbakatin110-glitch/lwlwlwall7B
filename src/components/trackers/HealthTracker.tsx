"use client";

import { useMemo, useState } from "react";
import {
  DiaryChip,
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
import {
  entriesForToday,
  entryTimeMs,
  formatClock,
  todayYmd,
} from "@/lib/diary-day";
import { useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const JOURNAL = "health";

const TEMP_PRESETS = [36.6, 37.0, 37.2, 37.5, 38.0, 38.5] as const;

const SYMPTOMS = [
  "кашель",
  "насморк",
  "сыпь",
  "рвота",
  "понос",
  "беспокойство",
  "другое",
] as const;

function entryTemp(e: JournalEntry): number | null {
  const t = e.fields?.temp;
  if (typeof t === "number" && Number.isFinite(t) && t > 0) return t;
  const m = e.value.match(/([\d]+[.,]\d*)\s*°?/);
  return m ? Number(m[1].replace(",", ".")) : null;
}

function entrySymptoms(e: JournalEntry): string {
  const s = e.fields?.symptoms;
  if (typeof s === "string" && s.trim()) return s.trim();
  const parts = e.value.split("·").map((x) => x.trim());
  if (parts.length > 1) return parts.slice(1).join(" · ");
  if (!entryTemp(e)) return e.value.trim();
  return "";
}

function formatTemp(t: number): string {
  return t % 1 === 0 ? t.toFixed(1) : String(t);
}

function buildValue(temp: number | null, symptoms: string): string {
  const parts: string[] = [];
  if (temp != null) parts.push(formatTemp(temp));
  if (symptoms) parts.push(symptoms);
  return parts.join(" · ");
}

export function HealthTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => s.journals[JOURNAL] ?? []);
  const [temp, setTemp] = useState<number | "">("");
  const [customTemp, setCustomTemp] = useState("");
  const [symptom, setSymptom] = useState("");
  const [customSymptom, setCustomSymptom] = useState("");

  const todayEntries = useMemo(
    () =>
      [...entriesForToday(entries)]
        .map((e) => ({
          e,
          temp: entryTemp(e),
          symptoms: entrySymptoms(e),
          startMs: entryTimeMs(e),
        }))
        .sort((a, b) => b.startMs - a.startMs),
    [entries],
  );

  const stats = useMemo(() => {
    let symptomCount = 0;
    let lastTemp: number | null = null;
    for (const item of todayEntries) {
      if (item.symptoms) symptomCount++;
      if (item.temp != null) lastTemp = item.temp;
    }
    return {
      total: todayEntries.length,
      lastTemp,
      symptomCount,
    };
  }, [todayEntries]);

  const resolvedSymptom =
    symptom === "другое" ? customSymptom.trim() : symptom;
  const customTempNum = Number(customTemp.replace(",", "."));
  const activeTemp =
    temp !== ""
      ? temp
      : Number.isFinite(customTempNum) && customTempNum > 0
        ? customTempNum
        : null;
  const canSave = activeTemp != null || resolvedSymptom.length > 0;

  function save() {
    if (!canSave) return;
    const startMs = Date.now();
    const fields: Record<string, string | number> = { startMs };
    if (activeTemp != null) fields.temp = activeTemp;
    if (resolvedSymptom) fields.symptoms = resolvedSymptom;
    addJournalEntry(JOURNAL, {
      date: todayYmd(),
      value: buildValue(activeTemp, resolvedSymptom),
      note: "",
      fields,
    });
    setTemp("");
    setCustomTemp("");
    setSymptom("");
    setCustomSymptom("");
  }

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          { label: "записей сегодня", value: stats.total },
          {
            label: "последняя t°",
            value: stats.lastTemp != null ? formatTemp(stats.lastTemp) : "—",
          },
          { label: "симптомов", value: stats.symptomCount },
        ]}
      />

      <DiaryCoach
        tone={
          stats.lastTemp != null && stats.lastTemp >= 38
            ? "go"
            : stats.lastTemp != null && stats.lastTemp >= 37.5
              ? "watch"
              : stats.total === 0
                ? "tip"
                : "ok"
        }
        title={
          stats.lastTemp != null && stats.lastTemp >= 38
            ? "Температура высокая"
            : stats.lastTemp != null && stats.lastTemp >= 37.5
              ? "Субфебрильная"
              : stats.total === 0
                ? "Один замер — уже история"
                : "Держим руку на пульсе"
        }
      >
        {stats.lastTemp != null && stats.lastTemp >= 38
          ? "38° и выше у малыша — повод связаться с педиатром, особенно до 3 месяцев. Это не диагноз, а сигнал не ждать «само пройдёт»."
          : stats.lastTemp != null && stats.lastTemp >= 37.5
            ? "Перемерьте через 30–40 минут в покое. Пейте, не кутайте. Если растёт или появилась вялость — к врачу."
            : "Записывайте t° и симптом в одно время суток — так видно динамику, а не разовое «ну вроде тепло»."}
      </DiaryCoach>

      <div className="mt-5 rounded-2xl border border-line bg-card p-4">
        <p className="text-[11px] font-medium text-muted">Температура</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TEMP_PRESETS.map((t) => (
            <DiaryChip
              key={t}
              active={temp === t}
              tone={t >= 38 ? "warn" : t >= 37.5 ? "hot" : "default"}
              onClick={() => {
                setTemp(temp === t ? "" : t);
                setCustomTemp("");
              }}
            >
              {formatTemp(t)}
            </DiaryChip>
          ))}
        </div>
        <input
          type="text"
          inputMode="decimal"
          value={customTemp}
          onChange={(e) => {
            setCustomTemp(e.target.value);
            setTemp("");
          }}
          placeholder="Своя t°"
          className="mt-3 w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-sm tabular-nums"
        />

        <p className="mt-4 text-[11px] font-medium text-muted">Симптом</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SYMPTOMS.map((s) => (
            <DiaryChip
              key={s}
              active={symptom === s}
              onClick={() => setSymptom(symptom === s ? "" : s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </DiaryChip>
          ))}
        </div>
        {symptom === "другое" ? (
          <input
            value={customSymptom}
            onChange={(e) => setCustomSymptom(e.target.value)}
            placeholder="Опишите симптом"
            className="mt-3 w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-sm"
          />
        ) : null}
      </div>

      {todayEntries.length > 0 ? (
        <div className="mt-6">
          <DiarySectionTitle left="Сегодня" right={`${stats.total}`} />
          <DiaryTimeline>
            {todayEntries.map((item, i) => (
              <li key={item.e.id}>
                <DiaryTimelineRow
                  accent={i === 0}
                  mark={
                    item.temp != null ? (
                      <span className="text-[10px] tabular-nums">
                        {formatTemp(item.temp)}
                      </span>
                    ) : (
                      "·"
                    )
                  }
                  left={
                    <div>
                      <span className="text-[11px] tabular-nums text-muted">
                        {formatClock(item.startMs)}
                      </span>
                      {item.symptoms ? (
                        <p className="text-sm font-medium capitalize leading-snug">
                          {item.symptoms}
                        </p>
                      ) : null}
                    </div>
                  }
                  right={
                    item.temp != null ? (
                      <span className="text-sm tabular-nums text-muted">
                        {formatTemp(item.temp)}°
                      </span>
                    ) : (
                      <span className="text-sm text-muted/40">—</span>
                    )
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
        <DiaryEmpty>Отметьте температуру или симптом</DiaryEmpty>
      )}

      <DiaryStickyCta>
        <DiaryPrimaryButton disabled={!canSave} onClick={save}>
          Сохранить
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
