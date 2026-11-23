"use client";

import { useMemo, useState } from "react";
import { DiaryPage } from "@/components/diary/DiaryShell";
import { useAppStore } from "@/lib/store";
import { todayYmd } from "@/lib/diary-day";
import {
  jawLabel,
  sideLabel,
  teethOf,
  TOOTH_BY_ID,
  type ToothDef,
} from "@/lib/teeth";

const CHART = { w: 340, h: 250, cx: 170, cy: 125, rx: 132, ry: 96 };

function ringTeeth(): ToothDef[] {
  const upper = teethOf("upper");
  const lower = teethOf("lower");
  return [...upper, ...[...lower].reverse()];
}

function dotAt(index: number) {
  const deg = 200 + index * 18;
  const a = (deg * Math.PI) / 180;
  return {
    x: CHART.cx + CHART.rx * Math.cos(a),
    y: CHART.cy + CHART.ry * Math.sin(a),
  };
}

function monthsBetween(birth: string, date: string): number | null {
  if (!birth) return null;
  const b = new Date(`${birth}T12:00:00`);
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(b.getTime()) || Number.isNaN(d.getTime())) return null;
  let months =
    (d.getFullYear() - b.getFullYear()) * 12 + (d.getMonth() - b.getMonth());
  if (d.getDate() < b.getDate()) months -= 1;
  return months;
}

function ageAtPhrase(months: number | null): string | null {
  if (months == null || months < 0) return null;
  if (months === 0) return "в первый месяц";
  return `в ${months} мес`;
}

function toothTitle(tooth: ToothDef): string {
  const jaw = tooth.jaw === "upper" ? "Верхний" : "Нижний";
  return `${jaw} ${tooth.name.toLowerCase()} ${sideLabel(tooth.side)}`;
}

export function TeethTracker() {
  const entries = useAppStore((s) => s.journals.teeth ?? []);
  const birthDate = useAppStore((s) => s.profile?.birthDate) ?? "";
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const erupted = useMemo(() => {
    const map = new Map<string, { id: string; date: string }>();
    for (const entry of entries) {
      const toothId = String(entry.fields?.toothId || "");
      if (!TOOTH_BY_ID[toothId]) continue;
      const prev = map.get(toothId);
      if (!prev || entry.date >= prev.date) {
        map.set(toothId, { id: entry.id, date: entry.date });
      }
    }
    return map;
  }, [entries]);

  const ring = useMemo(() => ringTeeth(), []);

  function mark(tooth: ToothDef) {
    addJournalEntry("teeth", {
      date: todayYmd(),
      value: `${tooth.name} · ${jawLabel(tooth.jaw)} · ${sideLabel(tooth.side)}`,
      note: "",
      fields: { toothId: tooth.id, startMs: Date.now() },
    });
    setSelectedId(tooth.id);
  }

  function unmark(toothId: string) {
    for (const entry of entries) {
      if (String(entry.fields?.toothId || "") === toothId) {
        removeJournalEntry("teeth", entry.id);
      }
    }
    setSelectedId(toothId);
  }

  function onDot(tooth: ToothDef) {
    if (erupted.has(tooth.id)) unmark(tooth.id);
    else mark(tooth);
  }

  const history = [...erupted.entries()]
    .map(([toothId, mark]) => ({ tooth: TOOTH_BY_ID[toothId], ...mark }))
    .filter((row) => row.tooth)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <DiaryPage>
      <div className="rounded-[1.6rem] border border-line bg-card px-4 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-base font-semibold">Молочные зубки</p>
          <p className="text-sm text-muted">{erupted.size} из 20</p>
        </div>

        <svg
          viewBox={`0 0 ${CHART.w} ${CHART.h}`}
          className="mx-auto mt-2 h-auto w-full max-w-sm"
        >
          {ring.map((tooth, index) => {
            const at = dotAt(index);
            const on = erupted.has(tooth.id);
            const active = selectedId === tooth.id;
            return (
              <g
                key={tooth.id}
                role="button"
                tabIndex={0}
                aria-label={`${tooth.name}, ${jawLabel(tooth.jaw)}, ${sideLabel(tooth.side)}`}
                aria-pressed={on}
                className="cursor-pointer"
                style={{ outline: "none" }}
                onClick={() => onDot(tooth)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onDot(tooth);
                }}
              >
                <circle cx={at.x} cy={at.y} r="16" fill="transparent" />
                <circle
                  cx={at.x}
                  cy={at.y}
                  r="11"
                  fill={on ? "#5cbf8a" : "transparent"}
                  stroke={active ? "var(--accent)" : on ? "#5cbf8a" : "#c8c8c8"}
                  strokeWidth={active ? 2.4 : 1.6}
                />
              </g>
            );
          })}
        </svg>

        <p className="text-center text-sm text-muted">
          Нажмите на зубик, чтобы отметить его или убрать.
        </p>
      </div>

      {history.length > 0 ? (
        <div>
          <p className="px-1 text-base font-semibold">Отмеченные зубки</p>
          <ul className="mt-2 space-y-2">
            {history.map((row) => {
              const when = new Date(`${row.date}T12:00:00`).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const age = ageAtPhrase(monthsBetween(birthDate, row.date));
              return (
                <li
                  key={row.tooth.id}
                  className="rounded-2xl border border-line bg-card px-4 py-3"
                >
                  <span className="block text-sm font-semibold">{toothTitle(row.tooth)}</span>
                  <span className="text-[12px] text-muted">
                    {when}
                    {age ? ` · ${age}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

    </DiaryPage>
  );
}
