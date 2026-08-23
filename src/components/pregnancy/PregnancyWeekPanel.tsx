"use client";

import { useMemo, useState } from "react";
import {
  daysUntilDue,
  dueDateFromLmp,
  pregnancyAgeLabel,
  pregnancyWeek,
  trimesterLabel,
  weekBlurb,
} from "@/lib/pregnancy";
import { localToday } from "@/lib/local-date";
import { useAppStore } from "@/lib/store";

export function PregnancyWeekPanel() {
  const pregnancy = useAppStore((s) => s.pregnancy);
  const setPregnancy = useAppStore((s) => s.setPregnancy);
  const enablePregnancyModules = useAppStore((s) => s.enablePregnancyModules);
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const [due, setDue] = useState(pregnancy?.dueDate || "");
  const [lmp, setLmp] = useState(pregnancy?.lmpDate || "");
  const [note, setNote] = useState("");

  const week = useMemo(
    () =>
      pregnancyWeek(
        pregnancy?.dueDate || due,
        pregnancy?.lmpDate || lmp || undefined,
      ),
    [pregnancy?.dueDate, pregnancy?.lmpDate, due, lmp],
  );
  const left = useMemo(
    () => daysUntilDue(pregnancy?.dueDate || due),
    [pregnancy?.dueDate, due],
  );
  const blurb = week != null ? weekBlurb(week) : null;

  function saveDates() {
    let nextDue = due.trim();
    if (!nextDue && lmp.trim()) {
      nextDue = dueDateFromLmp(lmp) || "";
      if (nextDue) setDue(nextDue);
    }
    if (!nextDue) return;
    setPregnancy({
      active: true,
      dueDate: nextDue,
      lmpDate: lmp.trim() || undefined,
    });
    enablePregnancyModules();
  }

  function saveNote() {
    if (!note.trim()) return;
    addJournalEntry("pregnancy", {
      date: localToday(),
      value:
        week != null
          ? `${week} нед. · ${note.trim()}`
          : note.trim(),
      note: "",
      fields: week != null ? { week } : undefined,
    });
    setNote("");
  }

  return (
    <div className="space-y-4">
      {week != null && pregnancy?.active && pregnancy.dueDate ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft/50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            {trimesterLabel(week)}
          </p>
          <p className="font-display mt-1 text-3xl font-semibold tracking-tight">
            {pregnancyAgeLabel(pregnancy.dueDate, pregnancy.lmpDate) ??
              `${week}-я неделя`}
          </p>
          <p className="mt-2 text-sm text-muted">
            Малыш примерно как {blurb?.size}.{" "}
            {left != null && left >= 0
              ? `До ПДР ≈ ${left} дн.`
              : left != null
                ? `ПДР была ${Math.abs(left)} дн. назад`
                : null}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">
            {blurb?.tip}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Укажите ПДР или дату последних месячных — Мая посчитает неделю.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            ПДР
          </span>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-card/70 px-3 py-2.5"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Первый день месячных
          </span>
          <input
            type="date"
            value={lmp}
            onChange={(e) => setLmp(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-card/70 px-3 py-2.5"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={saveDates}
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
      >
        Сохранить срок
      </button>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Заметка к неделе
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Как себя чувствую, что сказал врач…"
          className="mt-1 w-full rounded-xl border border-line bg-card/70 px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={saveNote}
          className="mt-2 rounded-xl border border-line px-3 py-2 text-sm font-medium"
        >
          Записать в дневник
        </button>
      </div>
    </div>
  );
}
