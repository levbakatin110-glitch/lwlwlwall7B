"use client";

import { useEffect, useMemo, useState } from "react";
import type { CustomModule, JournalEntry, SmartPanel } from "@/lib/types";
import { useAppStore } from "@/lib/store";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daySet(entries: JournalEntry[]) {
  return new Set(entries.map((e) => e.date));
}

function calcStreak(dates: Set<string>) {
  let streak = 0;
  const d = new Date();
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (!dates.has(key)) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function fmtSec(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Умный виджет: вехи, таймер, цель, шкала, серия */
export function CustomSmartPanel({
  moduleId,
  mod,
  onPrefill,
}: {
  moduleId: string;
  mod: CustomModule;
  onPrefill: (text: string) => void;
}) {
  const smart = mod.smart as SmartPanel | undefined;
  const entries = useAppStore((s) => s.journals[moduleId] ?? []);
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);

  const [timerOn, setTimerOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!timerOn) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerOn]);

  const doneMilestones = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      const id = e.fields?.milestoneId;
      if (id != null) set.add(String(id));
      for (const m of smart?.milestones ?? []) {
        if (e.value.toLowerCase().includes(m.label.toLowerCase())) {
          set.add(m.id);
        }
      }
    }
    return set;
  }, [entries, smart?.milestones]);

  const goalProgress = useMemo(() => {
    if (!smart || smart.kind !== "goal") return 0;
    const key = smart.goalFieldKey;
    let sum = 0;
    for (const e of entries) {
      if (key && e.fields?.[key] != null) {
        const n = Number(e.fields[key]);
        if (Number.isFinite(n)) sum += n;
      } else {
        const m = e.value.match(/(\d+(?:[.,]\d+)?)/);
        if (m) sum += Number(m[1].replace(",", "."));
      }
    }
    return sum;
  }, [entries, smart]);

  const todayMinutes = useMemo(() => {
    const today = todayIso();
    return entries
      .filter((e) => e.date === today)
      .reduce((sum, e) => {
        const m = Number(e.fields?.minutes);
        if (Number.isFinite(m)) return sum + m;
        const t = e.value.match(/(\d+)\s*мин/i);
        return sum + (t ? Number(t[1]) : 0);
      }, 0);
  }, [entries]);

  const streak = useMemo(() => calcStreak(daySet(entries)), [entries]);

  if (!smart) return null;

  function log(value: string, fields?: Record<string, string | number>) {
    addJournalEntry(moduleId, {
      date: todayIso(),
      value,
      note: "",
      fields,
    });
  }

  function stopTimer(save: boolean) {
    setTimerOn(false);
    if (save && elapsed >= 5) {
      const mins = Math.max(1, Math.round(elapsed / 60));
      const label = smart?.timerLabel || "Занятие";
      const unit = smart?.timerUnit || "мин";
      log(`${label} · ${mins} ${unit}`, { minutes: mins });
      setFlash(true);
      window.setTimeout(() => setFlash(false), 2000);
    }
    setElapsed(0);
  }

  return (
    <div className="maya-rise mt-4 space-y-3 rounded-[1.5rem] border border-line bg-card/90 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
          {smart.title}
        </h2>
        {smart.subtitle && (
          <p className="mt-1 text-sm text-muted">{smart.subtitle}</p>
        )}
      </div>

      {smart.kind === "timer" && (
        <div className="rounded-2xl bg-accent-soft/50 px-4 py-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {smart.timerLabel || "Занятие"}
          </p>
          <p className="font-mono mt-2 text-5xl font-semibold tabular-nums tracking-tight text-foreground">
            {fmtSec(elapsed)}
          </p>
          {todayMinutes > 0 && (
            <p className="mt-2 text-xs text-muted">
              Сегодня уже ~{todayMinutes} {smart.timerUnit || "мин"}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            {!timerOn ? (
              <button
                type="button"
                onClick={() => {
                  setElapsed(0);
                  setTimerOn(true);
                }}
                className="flex-1 rounded-2xl bg-accent py-3 text-sm font-semibold text-[var(--on-accent)]"
              >
                Старт
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => stopTimer(true)}
                  className="flex-1 rounded-2xl bg-accent py-3 text-sm font-semibold text-[var(--on-accent)]"
                >
                  Стоп · сохранить
                </button>
                <button
                  type="button"
                  onClick={() => stopTimer(false)}
                  className="rounded-2xl border border-line px-4 py-3 text-sm text-muted"
                >
                  Сброс
                </button>
              </>
            )}
          </div>
          {flash && (
            <p className="maya-msg-in mt-2 text-sm font-medium text-accent">
              Записано
            </p>
          )}
        </div>
      )}

      {smart.kind === "milestones" && smart.milestones && (
        <ul className="space-y-2">
          {smart.milestones.map((m) => {
            const done = doneMilestones.has(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (done) return;
                    log(`Веха: ${m.label}`, { milestoneId: m.id });
                  }}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                    done
                      ? "border-accent/40 bg-accent-soft/70"
                      : "border-line hover:border-accent/35 hover:bg-accent-soft/40"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                      done
                        ? "bg-accent text-[var(--on-accent)]"
                        : "border border-line text-muted"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {m.label}
                    </span>
                    {m.hint && (
                      <span className="mt-0.5 block text-xs text-muted">
                        {m.hint}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {smart.kind === "goal" && (
        <div>
          <div className="flex items-end justify-between gap-2">
            <p className="text-sm text-muted">{smart.goalLabel}</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-foreground">
              {Math.round(goalProgress * 10) / 10}
              <span className="text-base text-muted">
                /{smart.goalTarget}
                {smart.goalUnit ? ` ${smart.goalUnit}` : ""}
              </span>
            </p>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{
                width: `${Math.min(
                  100,
                  (goalProgress / Math.max(1, smart.goalTarget || 1)) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {smart.kind === "scale" && (
        <div>
          <div className="mb-2 flex justify-between text-[11px] text-muted">
            <span>{smart.scaleMinLabel}</span>
            <span>{smart.scaleMaxLabel}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  const key = smart.scaleFieldKey || "score";
                  log(`${n}/10`, { [key]: n });
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-sm font-semibold text-foreground hover:border-accent/40 hover:bg-accent-soft"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {smart.kind === "streak" && (
        <div className="rounded-2xl bg-accent-soft/60 px-4 py-4 text-center">
          <p className="font-display text-4xl font-semibold tabular-nums text-foreground">
            {streak}
          </p>
          <p className="mt-1 text-sm text-muted">
            {smart.streakLabel || "Дней подряд"}
          </p>
          <button
            type="button"
            onClick={() => log("Сделано сегодня", { done: 1 })}
            className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
          >
            Отметить сегодня
          </button>
        </div>
      )}

      {smart.tips && smart.tips.length > 0 && (
        <ul className="space-y-1.5">
          {smart.tips.map((tip) => (
            <li key={tip} className="text-xs leading-relaxed text-muted">
              · {tip}
            </li>
          ))}
        </ul>
      )}

      {smart.quickAdds && smart.quickAdds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {smart.quickAdds.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => onPrefill(q.prefill || "")}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-accent/40 hover:bg-accent-soft"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
