"use client";

import { useMemo, useState } from "react";
import {
  CALENDAR_AGE_COLS,
  CALENDAR_VACCINES,
  EXTRA_AGE_COLS,
  EXTRA_VACCINES,
  VACCINE_SOURCE_NOTE,
  VACCINES_CATALOG,
  matchDoseFromText,
  type AgeCol,
  type DoseTone,
  type VaccineDose,
  type VaccineInfo,
} from "@/lib/vaccines-catalog";
import { localToday } from "@/lib/local-date";
import { useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

type DoneMap = Map<string, JournalEntry>;

function buildDoneMap(entries: JournalEntry[]): DoneMap {
  const map: DoneMap = new Map();
  for (const e of entries) {
    const doseId = e.fields?.doseId != null ? String(e.fields.doseId) : null;
    if (doseId) {
      if (!map.has(doseId)) map.set(doseId, e);
      continue;
    }
    const matched = matchDoseFromText(`${e.value} ${e.note}`);
    if (matched && !map.has(matched)) map.set(matched, e);
  }
  return map;
}

function formatRuDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toneClass(tone: DoseTone | undefined, done: boolean) {
  if (done) {
    return "border-transparent bg-accent text-[var(--on-accent,#fff)] shadow-[0_1px_0_rgba(0,0,0,0.06)]";
  }
  if (tone === "risk") {
    return "border-[#d4b8e8]/70 bg-[linear-gradient(180deg,#f4e8fb,#ead6f6)] text-[#4a2a5c] dark:border-[#9b6fb8]/40 dark:bg-[#4a3560] dark:text-[#f0e4ff]";
  }
  if (tone === "catchup") {
    return "border-emerald-400/45 bg-[linear-gradient(180deg,#ecfdf5,#d1fae5)] text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100";
  }
  return "border-amber-400/40 bg-[linear-gradient(180deg,#fffbeb,#fde68a)] text-amber-950 dark:border-amber-400/35 dark:bg-amber-950/45 dark:text-amber-50";
}

function dosesAtCol(v: VaccineInfo, colId: string): VaccineDose[] {
  return v.doses.filter((d) => d.ageCol === colId);
}

function CalendarGrid({
  title,
  subtitle,
  ages,
  vaccines,
  done,
  onCell,
}: {
  title: string;
  subtitle: string;
  ages: AgeCol[];
  vaccines: VaccineInfo[];
  done: DoneMap;
  onCell: (vaccine: VaccineInfo, dose: VaccineDose) => void;
}) {
  const monthCols = ages.filter((a) => a.band === "m");
  const yearCols = ages.filter((a) => a.band === "y");
  const total = vaccines.reduce((n, v) => n + v.doses.length, 0);
  const count = vaccines.reduce(
    (n, v) => n + v.doses.filter((d) => done.has(d.id)).length,
    0,
  );
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <section className="overflow-hidden rounded-3xl border border-line/80 bg-card shadow-[0_10px_40px_-28px_rgba(80,40,60,0.35)]">
      <div className="border-b border-line/60 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--accent-soft)_55%,transparent),transparent)] px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-semibold tabular-nums text-accent">
              {count}
              <span className="text-sm font-medium text-muted">/{total}</span>
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
              отмечено
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/80">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-max min-w-full border-collapse text-left">
          <thead>
            <tr className="bg-background/70">
              <th
                rowSpan={2}
                className="sticky left-0 z-20 border-b border-r border-line bg-card px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted shadow-[6px_0_12px_-8px_rgba(40,20,30,0.35)]"
              >
                Прививка
              </th>
              {monthCols.length > 0 && (
                <th
                  colSpan={monthCols.length}
                  className="border-b border-line px-1 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-800/90 dark:text-amber-200"
                >
                  Месяцы
                </th>
              )}
              {yearCols.length > 0 && (
                <th
                  colSpan={yearCols.length}
                  className="border-b border-l border-line px-1 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-800/90 dark:text-sky-200"
                >
                  Годы
                </th>
              )}
            </tr>
            <tr className="bg-background/50">
              {ages.map((a) => (
                <th
                  key={a.id}
                  className={`border-b border-line px-0.5 py-2 text-center text-[11px] font-bold tabular-nums text-foreground/90 ${
                    a.band === "y" ? "border-l border-line/50" : ""
                  }`}
                >
                  {a.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vaccines.map((v, rowIdx) => (
              <tr
                key={v.id}
                className={
                  rowIdx % 2 === 0 ? "bg-card/50" : "bg-background/40"
                }
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[7.75rem] border-r border-line bg-inherit px-3 py-2.5 text-left text-[12px] font-semibold leading-snug text-foreground shadow-[6px_0_12px_-8px_rgba(40,20,30,0.28)] sm:max-w-[10.5rem] sm:text-[13px]"
                >
                  {v.name}
                </th>
                {ages.map((a) => {
                  const doses = dosesAtCol(v, a.id);
                  return (
                    <td
                      key={a.id}
                      className={`border-b border-line/40 px-0.5 py-1.5 align-middle ${
                        a.band === "y" ? "border-l border-line/35" : ""
                      }`}
                    >
                      {doses.length === 0 ? (
                        <span
                          className="mx-auto block h-2 w-2 rounded-full bg-line/70"
                          aria-hidden
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          {doses.map((dose) => {
                            const entry = done.get(dose.id);
                            const isDone = Boolean(entry);
                            return (
                              <button
                                key={dose.id}
                                type="button"
                                title={
                                  isDone
                                    ? `${dose.label} · была ${formatRuDate(entry!.date)} · нажмите снять`
                                    : `${dose.label} · ${dose.ageHint} · отметить`
                                }
                                onClick={() => onCell(v, dose)}
                                className={`flex h-8 min-w-[2.75rem] items-center justify-center rounded-xl border px-1.5 text-[11px] font-bold tabular-nums transition hover:-translate-y-0.5 hover:shadow-sm active:scale-95 sm:min-w-[3rem] ${toneClass(
                                  dose.tone,
                                  isDone,
                                )}`}
                              >
                                {isDone ? "✓" : dose.cell}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line/60 px-4 py-3 text-[10px] text-muted sm:px-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-background/60 px-2.5 py-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-300" />
          всем
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-background/60 px-2.5 py-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#d8b8ec]" />
          группа риска
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-background/60 px-2.5 py-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          была
        </span>
        <span className="px-1 py-1 text-muted">V — вакцинация · RV — ревакцинация</span>
      </div>
    </section>
  );
}

export function VaccinesTracker() {
  const entries = useAppStore((s) => s.journals?.vaccines ?? []);
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);

  const [markDate, setMarkDate] = useState(() => localToday());
  const [sheet, setSheet] = useState<{
    vaccine: VaccineInfo;
    dose: VaccineDose;
  } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [flash, setFlash] = useState(false);

  const done = useMemo(() => buildDoneMap(entries), [entries]);
  const customEntries = useMemo(
    () =>
      entries.filter(
        (e) =>
          e.fields?.custom === 1 ||
          (!e.fields?.doseId && !matchDoseFromText(`${e.value} ${e.note}`)),
      ),
    [entries],
  );

  const detailVaccine = detailId
    ? VACCINES_CATALOG.find((v) => v.id === detailId) ?? null
    : null;

  function openCell(vaccine: VaccineInfo, dose: VaccineDose) {
    const entry = done.get(dose.id);
    if (entry) {
      removeJournalEntry("vaccines", entry.id);
      return;
    }
    setSheet({ vaccine, dose });
    setDetailId(vaccine.id);
  }

  function confirmMark() {
    if (!sheet) return;
    try {
      const { vaccine, dose } = sheet;
      if (done.has(dose.id)) {
        setSheet(null);
        return;
      }
      const date =
        typeof markDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(markDate)
          ? markDate
          : localToday();
      addJournalEntry("vaccines", {
        date,
        value: `${vaccine.name} · ${dose.label}`,
        note: `визит · ${dose.cell} · ${dose.ageHint}`,
        fields: {
          vaccineId: vaccine.id,
          doseId: dose.id,
          status: "done",
          group: vaccine.group,
          cell: dose.cell,
        },
      });
      setSheet(null);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 2000);
    } catch (err) {
      console.warn("[maya] mark vaccine failed", err);
    }
  }

  function saveCustom() {
    try {
      const name = customName.trim();
      if (!name) return;
      const date =
        typeof markDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(markDate)
          ? markDate
          : localToday();
      addJournalEntry("vaccines", {
        date,
        value: name,
        note: "своя запись · вне списков",
        fields: { custom: 1, status: "done", group: "extra" },
      });
      setCustomName("");
      setFlash(true);
      window.setTimeout(() => setFlash(false), 2000);
    } catch (err) {
      console.warn("[maya] custom vaccine failed", err);
    }
  }

  return (
    <div className="maya-rise space-y-4">
      <div className="rounded-3xl border border-line/80 bg-[linear-gradient(165deg,color-mix(in_oklab,var(--accent-soft)_70%,var(--card)),var(--card))] p-4 shadow-[0_10px_40px_-28px_rgba(80,40,60,0.3)] sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          прививки
        </p>
        <h2 className="font-display mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
          Календарь прививок
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Возраст сверху, прививка слева. Листайте вбок и нажмите ячейку (V1,
          RV…), чтобы отметить визит.
        </p>
        {flash && (
          <p className="maya-msg-in mt-3 text-sm font-medium text-accent">
            Визит записан
          </p>
        )}
      </div>

      <CalendarGrid
        title="По календарю РФ"
        subtitle="Национальный календарь профилактических прививок"
        ages={CALENDAR_AGE_COLS}
        vaccines={CALENDAR_VACCINES}
        done={done}
        onCell={openCell}
      />

      <CalendarGrid
        title="Вне календаря"
        subtitle="Рекомендуемые / платные / по эпидпоказаниям"
        ages={EXTRA_AGE_COLS}
        vaccines={EXTRA_VACCINES}
        done={done}
        onCell={openCell}
      />

      {detailVaccine && !sheet && (
        <div className="rounded-2xl border border-line bg-card/80 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-lg font-semibold">
                {detailVaccine.name}
              </p>
              <p className="mt-1 text-sm text-muted">{detailVaccine.protects}</p>
            </div>
            <button
              type="button"
              onClick={() => setDetailId(null)}
              className="text-xs text-muted"
            >
              Скрыть
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                Плюсы
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {detailVaccine.pros.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                Нюансы
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {detailVaccine.cons.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blush">
                Побочки
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {detailVaccine.sideEffects.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {sheet && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-card/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <div className="mx-auto max-w-lg">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Отметить визит
            </p>
            <p className="font-display mt-1 text-lg font-semibold">
              {sheet.vaccine.name}
            </p>
            <p className="text-sm text-muted">
              {sheet.dose.cell} · {sheet.dose.label} · {sheet.dose.ageHint}
            </p>
            <label className="mt-3 block text-[11px] text-muted">
              Дата визита
              <input
                type="date"
                value={markDate}
                onChange={(e) => setMarkDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm text-foreground"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={confirmMark}
                className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-[var(--on-accent,#fff)]"
              >
                Была в этот день
              </button>
              <button
                type="button"
                onClick={() => setSheet(null)}
                className="rounded-xl border border-line px-4 py-3 text-sm text-muted"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-line bg-card/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Ещё своя прививка
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-[11px] text-muted">
            Название
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Например, COVID"
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm text-foreground"
            />
          </label>
          <label className="text-[11px] text-muted">
            Дата
            <input
              type="date"
              value={markDate}
              onChange={(e) => setMarkDate(e.target.value)}
              className="mt-1 block rounded-xl border border-line bg-background px-3 py-2.5 text-sm text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={saveCustom}
            disabled={!customName.trim()}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-40"
          >
            Была
          </button>
        </div>
        {customEntries.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {customEntries.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  {e.value}
                  <span className="text-muted"> · {formatRuDate(e.date)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeJournalEntry("vaccines", e.id)}
                  className="shrink-0 text-xs text-muted hover:text-blush"
                >
                  Снять
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-muted">
        {VACCINE_SOURCE_NOTE}
      </p>
    </div>
  );
}
