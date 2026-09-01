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
import { getJournalEntries, useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const JOURNAL = "preg_symptoms";

const SYMPTOMS = [
  "тошнота",
  "изжога",
  "отёки",
  "головная боль",
  "усталость",
  "боль в спине",
  "бессонница",
  "другое",
] as const;

const SEVERITY_LABELS = ["", "лёгкая", "средняя", "сильная"] as const;

function entrySymptom(e: JournalEntry): { symptom: string; severity: number } {
  const symptom = String(e.fields?.symptom || "").trim();
  const severity = Number(e.fields?.severity);
  if (symptom) {
    return {
      symptom,
      severity: Number.isFinite(severity) && severity >= 1 && severity <= 3
        ? severity
        : 1,
    };
  }
  return { symptom: e.value, severity: 1 };
}

export function SymptomsTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => getJournalEntries(s, JOURNAL));
  const [symptom, setSymptom] = useState("");
  const [custom, setCustom] = useState("");
  const [severity, setSeverity] = useState(2);

  const todayEntries = useMemo(
    () =>
      entriesForToday(entries)
        .map((e) => ({
          e,
          ...entrySymptom(e),
          startMs: entryTimeMs(e),
        }))
        .filter((x) => x.symptom)
        .sort((a, b) => b.startMs - a.startMs),
    [entries],
  );

  const resolvedSymptom =
    symptom === "другое" ? custom.trim() : symptom;
  const canSave = resolvedSymptom.length > 0 && severity >= 1 && severity <= 3;

  function save() {
    if (!canSave) return;
    const startMs = Date.now();
    const sevLabel = SEVERITY_LABELS[severity];
    const value = `${resolvedSymptom} · ${sevLabel}`;
    addJournalEntry(JOURNAL, {
      date: todayYmd(),
      value,
      note: "",
      fields: { symptom: resolvedSymptom, severity, startMs },
    });
    setSymptom("");
    setCustom("");
    setSeverity(2);
  }

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          { label: "Сегодня", value: todayEntries.length },
          {
            label: "Последнее",
            value: todayEntries[0]?.symptom ?? "—",
          },
          {
            label: "Сила",
            value: todayEntries[0]
              ? SEVERITY_LABELS[todayEntries[0].severity] || "—"
              : "—",
          },
        ]}
      />

      <DiaryCoach
        tone={
          todayEntries[0]?.severity === 3
            ? "watch"
            : todayEntries.length === 0
              ? "tip"
              : "ok"
        }
        title={
          todayEntries[0]?.severity === 3
            ? "Сильный симптом — не терпите молча"
            : todayEntries.length === 0
              ? "Паттерн важнее разового «ой»"
              : "Записано — легче рассказать врачу"
        }
      >
        {todayEntries[0]?.severity === 3
          ? "Сильная головная боль, отёки лица/рук, мушки, боль в животе — не геройствуйте, звоните в ЖК или скорую. Дневник потом покажете."
          : "Тошнота, изжога, спина часто «нормы беременности», но всплеск или новое — повод отметить и спросить. Красные флаги: кровотечение, воды, нет шевелений."}
      </DiaryCoach>

      <div className="mt-5 rounded-2xl border border-line bg-card p-4">
        <p className="text-[11px] font-medium text-muted">Симптом</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SYMPTOMS.map((s) => (
            <DiaryChip
              key={s}
              active={symptom === s}
              onClick={() => setSymptom(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </DiaryChip>
          ))}
        </div>

        {symptom === "другое" ? (
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Опишите симптом"
            className="mt-3 w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 text-sm"
          />
        ) : null}

        <p className="mt-4 text-[11px] font-medium text-muted">Интенсивность</p>
        <div className="mt-2 flex gap-2">
          {([1, 2, 3] as const).map((n) => (
            <DiaryChip
              key={n}
              active={severity === n}
              tone={n === 3 ? "warn" : n === 2 ? "default" : "default"}
              onClick={() => setSeverity(n)}
            >
              {n} · {SEVERITY_LABELS[n]}
            </DiaryChip>
          ))}
        </div>
      </div>

      {todayEntries.length > 0 ? (
        <div className="mt-6">
          <DiarySectionTitle left="Сегодня" right={`${todayEntries.length}`} />
          <DiaryTimeline>
            {todayEntries.map((item, i) => (
              <li key={item.e.id}>
                <DiaryTimelineRow
                  accent={i === 0}
                  left={
                    <div>
                      <span className="text-[11px] tabular-nums text-muted">
                        {formatClock(item.startMs)}
                      </span>
                      <p className="text-sm font-medium capitalize leading-snug">
                        {item.symptom}
                      </p>
                    </div>
                  }
                  mark={item.severity}
                  right={
                    <span className="text-sm text-muted">
                      {SEVERITY_LABELS[item.severity]}
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
        <DiaryEmpty>Отметьте, что беспокоит сегодня</DiaryEmpty>
      )}

      <DiaryStickyCta>
        <DiaryPrimaryButton disabled={!canSave} onClick={save}>
          Сохранить
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
