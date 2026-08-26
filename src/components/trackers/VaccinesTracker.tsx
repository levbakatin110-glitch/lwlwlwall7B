"use client";

import { useMemo, useState } from "react";
import {
  CALENDAR_VACCINES,
  EXTRA_VACCINES,
  VACCINE_SOURCE_NOTE,
  VACCINES_CATALOG,
  matchDoseFromText,
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

function progressFor(list: VaccineInfo[], done: DoneMap) {
  const total = list.reduce((n, v) => n + v.doses.length, 0);
  const count = list.reduce(
    (n, v) => n + v.doses.filter((d) => done.has(d.id)).length,
    0,
  );
  return { total, count };
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "pro" | "con" | "side";
}) {
  const toneCls =
    tone === "pro"
      ? "text-accent"
      : tone === "con"
        ? "text-muted"
        : "text-blush";
  return (
    <div>
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${toneCls}`}
      >
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-foreground/90">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-40" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VaccineTable({
  title,
  subtitle,
  vaccines,
  done,
  expandedId,
  onExpand,
  markDate,
  onMarkDateChange,
  markingDoseId,
  setMarkingDoseId,
  onMark,
  onUnmark,
}: {
  title: string;
  subtitle: string;
  vaccines: VaccineInfo[];
  done: DoneMap;
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  markDate: string;
  onMarkDateChange: (v: string) => void;
  markingDoseId: string | null;
  setMarkingDoseId: (id: string | null) => void;
  onMark: (doseId: string) => void;
  onUnmark: (entryId: string) => void;
}) {
  const { total, count } = progressFor(vaccines, done);

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-line bg-card/80">
      <div className="border-b border-line/70 px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
            {title}
          </h2>
          <span className="text-xs font-medium text-muted">
            {count}/{total}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/60">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{
              width: `${Math.min(100, (count / Math.max(1, total)) * 100)}%`,
            }}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line/60 text-[11px] uppercase tracking-[0.12em] text-muted">
              <th className="px-3 py-2.5 font-semibold sm:px-4">Прививка</th>
              <th className="hidden px-3 py-2.5 font-semibold sm:table-cell sm:px-4">
                Срок
              </th>
              <th className="px-3 py-2.5 font-semibold sm:px-4">Статус</th>
            </tr>
          </thead>
          <tbody>
            {vaccines.map((v) => {
              const doneCount = v.doses.filter((d) => done.has(d.id)).length;
              const allDone =
                doneCount === v.doses.length && v.doses.length > 0;
              const open = expandedId === v.id;
              const lastDone = [...v.doses]
                .reverse()
                .map((d) => done.get(d.id))
                .find(Boolean);
              const ageHint =
                v.doses.length === 1
                  ? v.doses[0].ageHint
                  : `${v.doses[0].ageHint} → ${v.doses[v.doses.length - 1].ageHint}`;

              return (
                <tr key={v.id} className="border-b border-line/50 last:border-0">
                  <td colSpan={3} className="p-0">
                    <button
                      type="button"
                      onClick={() => onExpand(open ? null : v.id)}
                      className={`grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-3 py-3 text-left transition hover:bg-accent-soft/40 sm:grid-cols-[1fr_7.5rem_auto] sm:px-4 ${
                        allDone ? "bg-accent-soft/25" : ""
                      } ${open ? "bg-accent-soft/30" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">
                          {v.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted sm:hidden">
                          {ageHint}
                        </span>
                      </span>
                      <span className="hidden self-center text-xs text-muted sm:block">
                        {ageHint}
                      </span>
                      <span className="flex items-center gap-2 self-center justify-self-end">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            allDone
                              ? "bg-accent text-[var(--on-accent)]"
                              : doneCount > 0
                                ? "bg-accent-soft text-accent"
                                : "border border-line text-muted"
                          }`}
                        >
                          {allDone
                            ? lastDone
                              ? formatRuDate(lastDone.date)
                              : "готово"
                            : doneCount > 0
                              ? `${doneCount}/${v.doses.length}`
                              : "не была"}
                        </span>
                        <span className="text-muted" aria-hidden>
                          {open ? "▾" : "▸"}
                        </span>
                      </span>
                    </button>

                    {open && (
                      <div className="space-y-4 border-t border-line/50 bg-background/35 px-3 py-4 sm:px-4">
                        <p className="text-sm text-muted">{v.protects}</p>
                        <Section title="Плюсы" items={v.pros} tone="pro" />
                        <Section
                          title="Минусы / нюансы"
                          items={v.cons}
                          tone="con"
                        />
                        <Section
                          title="Возможные побочки"
                          items={v.sideEffects}
                          tone="side"
                        />

                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                            Когда ходила / поставили
                          </p>
                          <ul className="mt-2 space-y-2">
                            {v.doses.map((dose) => {
                              const entry = done.get(dose.id);
                              const isMarking = markingDoseId === dose.id;
                              return (
                                <li key={dose.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (entry) {
                                        onUnmark(entry.id);
                                        return;
                                      }
                                      setMarkingDoseId(
                                        isMarking ? null : dose.id,
                                      );
                                    }}
                                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                                      entry
                                        ? "border-accent/35 bg-accent-soft/50"
                                        : isMarking
                                          ? "border-accent/50 bg-card"
                                          : "border-line/80 bg-card/70 hover:border-accent/30"
                                    }`}
                                  >
                                    <span className="min-w-0">
                                      <span className="block text-sm font-medium">
                                        {dose.label}
                                      </span>
                                      <span className="block text-[11px] text-muted">
                                        ориентир: {dose.ageHint}
                                        {entry
                                          ? ` · была ${formatRuDate(entry.date)}`
                                          : " · нажмите, чтобы отметить визит"}
                                      </span>
                                    </span>
                                    <span
                                      className={`shrink-0 text-xs font-semibold ${
                                        entry ? "text-accent" : "text-muted"
                                      }`}
                                    >
                                      {entry ? "✓ снять" : isMarking ? "…" : "+"}
                                    </span>
                                  </button>
                                  {isMarking && !entry && (
                                    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-accent/30 bg-card px-3 py-2.5">
                                      <label className="text-[11px] text-muted">
                                        Дата визита
                                        <input
                                          type="date"
                                          value={markDate}
                                          onChange={(e) =>
                                            onMarkDateChange(e.target.value)
                                          }
                                          className="mt-1 block rounded-lg border border-line bg-background px-2.5 py-1.5 text-sm text-foreground"
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => onMark(dose.id)}
                                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)]"
                                      >
                                        Была в этот день
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setMarkingDoseId(null)}
                                        className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted"
                                      >
                                        Отмена
                                      </button>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function VaccinesTracker() {
  const entries = useAppStore((s) => s.journals.vaccines ?? []);
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);

  const [expandedId, setExpandedId] = useState<string | null>(
    CALENDAR_VACCINES[0]?.id ?? null,
  );
  const [markDate, setMarkDate] = useState(() => localToday());
  const [markingDoseId, setMarkingDoseId] = useState<string | null>(null);
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

  function markDose(doseId: string) {
    try {
      const vaccine = VACCINES_CATALOG.find((v) =>
        v.doses.some((d) => d.id === doseId),
      );
      const dose = vaccine?.doses.find((d) => d.id === doseId);
      if (!vaccine || !dose) return;
      if (done.has(doseId)) return;

      const date =
        typeof markDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(markDate)
          ? markDate
          : localToday();

      addJournalEntry("vaccines", {
        date,
        value: `${vaccine.name} · ${dose.label}`,
        note: `визит · ориентир: ${dose.ageHint}`,
        fields: {
          vaccineId: vaccine.id,
          doseId: dose.id,
          status: "done",
          group: vaccine.group,
        },
      });
      setMarkingDoseId(null);
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
      <div className="rounded-[1.5rem] border border-line bg-card/80 p-4 sm:p-5">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Прививки · Россия
        </h2>
        <p className="mt-1 text-sm text-muted">
          Две таблицы: по национальному календарю и вне него. Нажмите строку —
          плюсы, минусы, побочки и отметка, когда ходили.
        </p>
        {flash && (
          <p className="maya-msg-in mt-3 text-sm font-medium text-accent">
            Визит записан
          </p>
        )}
      </div>

      <VaccineTable
        title="По календарю РФ"
        subtitle="Национальный календарь профилактических прививок — обычно в поликлинике."
        vaccines={CALENDAR_VACCINES}
        done={done}
        expandedId={expandedId}
        onExpand={setExpandedId}
        markDate={markDate}
        onMarkDateChange={setMarkDate}
        markingDoseId={markingDoseId}
        setMarkingDoseId={setMarkingDoseId}
        onMark={markDose}
        onUnmark={(id) => removeJournalEntry("vaccines", id)}
      />

      <VaccineTable
        title="Вне календаря"
        subtitle="Рекомендуемые, платные или по эпидпоказаниям — ротавирус, ветрянка, менингококк и др."
        vaccines={EXTRA_VACCINES}
        done={done}
        expandedId={expandedId}
        onExpand={setExpandedId}
        markDate={markDate}
        onMarkDateChange={setMarkDate}
        markingDoseId={markingDoseId}
        setMarkingDoseId={setMarkingDoseId}
        onMark={markDose}
        onUnmark={(id) => removeJournalEntry("vaccines", id)}
      />

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
              placeholder="Например, COVID / другая"
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm text-foreground"
            />
          </label>
          <label className="text-[11px] text-muted">
            Дата визита
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
