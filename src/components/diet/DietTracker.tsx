"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ACTIVITY_OPTIONS,
  GOAL_OPTIONS,
  MEAL_OPTIONS,
  calcDiet,
  emptyDietDraft,
  isDietPlanReady,
} from "@/lib/diet";
import type {
  DietActivity,
  DietGoalMode,
  DietMeal,
  DietPlan,
  DietSex,
} from "@/lib/diet-types";
import { useAppStore } from "@/lib/store";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatTodayRu() {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
    }).format(new Date());
  } catch {
    return todayIso();
  }
}

const NUTRITION_GUIDE_URL = "https://lollypollya.ru/index.html#nutrition";

function parseKcal(e: {
  fields?: Record<string, string | number>;
  value: string;
}) {
  const fromField = Number(e.fields?.kcal);
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  const m = e.value.match(/(\d+)\s*ккал/i);
  return m ? Number(m[1]) : 0;
}

function segBtn(active: boolean) {
  return `flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
    active
      ? "bg-accent-soft text-foreground ring-2 ring-accent"
      : "border border-line bg-card text-muted hover:text-foreground"
  }`;
}

/**
 * Калькулятор калорий (Миффлин–Сан Жеор) + дневной лог.
 * Как у нормальных сервисов: данные → Рассчитать → ориентир ккал.
 */
export function DietTracker({ journalId = "diet" }: { journalId?: string }) {
  const stored = useAppStore((s) => s.dietPlan);
  const setDietPlan = useAppStore((s) => s.setDietPlan);
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const entries = useAppStore((s) => s.journals[journalId] ?? []);

  const [draft, setDraft] = useState(() => {
    const base = emptyDietDraft();
    if (!stored) return base;
    return {
      heightCm: stored.heightCm,
      weightKg: stored.weightKg,
      ageYears: stored.ageYears,
      sex: stored.sex,
      activity: stored.activity,
      goalMode: stored.goalMode || ("maintain" as DietGoalMode),
      targetWeightKg: stored.targetWeightKg,
      dailyKcalOverride: stored.dailyKcalOverride ?? null,
    };
  });

  const [result, setResult] = useState(() =>
    isDietPlanReady(stored) ? calcDiet(stored) : null,
  );
  const [meal, setMeal] = useState<DietMeal>("lunch");
  const [kcal, setKcal] = useState(350);
  const [food, setFood] = useState("");
  const [flash, setFlash] = useState(false);

  const todayKcal = useMemo(() => {
    const today = todayIso();
    return entries
      .filter((e) => e.date === today)
      .reduce((sum, e) => sum + parseKcal(e), 0);
  }, [entries]);

  function onCalculate(e: FormEvent) {
    e.preventDefault();
    const plan: DietPlan = {
      heightCm: Number(draft.heightCm),
      weightKg: Number(draft.weightKg),
      ageYears: Number(draft.ageYears),
      sex: draft.sex,
      activity: draft.activity,
      goalMode: draft.goalMode,
      targetWeightKg: draft.targetWeightKg,
      dailyKcalOverride: null,
      updatedAt: new Date().toISOString(),
    };
    if (
      !Number.isFinite(plan.ageYears) ||
      plan.ageYears < 14 ||
      !Number.isFinite(plan.weightKg) ||
      plan.weightKg < 35 ||
      !Number.isFinite(plan.heightCm) ||
      plan.heightCm < 130
    ) {
      return;
    }
    const calc = calcDiet(plan);
    setDietPlan(plan);
    setResult(calc);
    setKcal(Math.min(700, Math.max(200, Math.round(calc.targetKcal / 4))));
  }

  function logMeal() {
    if (kcal < 1) return;
    const mealLabel =
      MEAL_OPTIONS.find((m) => m.id === meal)?.label ?? "Приём";
    const foodLabel = food.trim();
    const value = foodLabel
      ? `${mealLabel} · ${kcal} ккал · ${foodLabel}`
      : `${mealLabel} · ${kcal} ккал`;
    addJournalEntry(journalId, {
      date: todayIso(),
      value,
      note: "",
      fields: { kcal, meal, food: foodLabel },
    });
    setFood("");
    setFlash(true);
    window.setTimeout(() => setFlash(false), 2000);
  }

  const goal = result?.targetKcal ?? 0;
  const over = goal > 0 ? Math.max(0, todayKcal - goal) : 0;
  const left = goal > 0 ? Math.max(0, goal - todayKcal) : 0;
  const progress = goal > 0 ? Math.min(1, todayKcal / goal) : 0;

  return (
    <div className="maya-rise space-y-5">
      {/* —— Калькулятор —— */}
      <section className="rounded-[1.5rem] border border-line bg-card p-5 shadow-sm sm:p-7">
        <div className="text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Калории на день
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Введите свои данные — покажем ориентир по калориям на сутки. Без
            лишних замеров и сложных меню.
          </p>
        </div>

        <form onSubmit={onCalculate} className="mx-auto mt-6 max-w-lg space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Пол</p>
            <div className="flex gap-2">
              {(
                [
                  { id: "female" as DietSex, label: "Женский" },
                  { id: "male" as DietSex, label: "Мужской" },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, sex: s.id }))}
                  className={segBtn(draft.sex === s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <label className="block text-sm">
              <span className="font-medium text-foreground">Возраст</span>
              <input
                type="number"
                inputMode="numeric"
                min={14}
                max={80}
                placeholder="лет"
                value={draft.ageYears || ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    ageYears: e.target.value === "" ? 0 : Number(e.target.value),
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-foreground placeholder:text-muted/60"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-foreground">Вес</span>
              <input
                type="number"
                inputMode="decimal"
                min={35}
                max={250}
                step={0.1}
                placeholder="кг"
                value={draft.weightKg || ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    weightKg: e.target.value === "" ? 0 : Number(e.target.value),
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-foreground placeholder:text-muted/60"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-foreground">Рост</span>
              <input
                type="number"
                inputMode="numeric"
                min={130}
                max={220}
                placeholder="см"
                value={draft.heightCm || ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    heightCm: e.target.value === "" ? 0 : Number(e.target.value),
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-foreground placeholder:text-muted/60"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-foreground">Активность</span>
            <select
              value={draft.activity}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  activity: e.target.value as DietActivity,
                }))
              }
              className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-foreground"
            >
              {ACTIVITY_OPTIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Цель</p>
            <div className="flex gap-2">
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({ ...d, goalMode: g.id }))
                  }
                  className={segBtn(draft.goalMode === g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[var(--on-accent)] shadow-sm transition hover:bg-accent-hot"
          >
            Рассчитать
          </button>

          <p className="text-center text-[11px] leading-relaxed text-muted">
            Ориентир по формуле Миффлина–Сан Жеора. Не заменяет консультацию
            врача или нутрициолога.
          </p>

          {!result && (
            <a
              href={NUTRITION_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent/40 hover:bg-accent-soft"
            >
              Гайд по питанию
              <span className="text-xs font-medium text-accent">↗</span>
            </a>
          )}
        </form>

        {result && (
          <div className="maya-msg-in mx-auto mt-6 max-w-lg space-y-3">
            <div className="rounded-2xl border border-accent/30 bg-accent-soft/50 px-5 py-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Ваш ориентир
              </p>
              <p className="font-display mt-2 text-4xl font-semibold tabular-nums tracking-tight text-foreground">
                {result.targetKcal}
                <span className="ml-1.5 text-lg font-medium text-muted">
                  ккал/день
                </span>
              </p>
              <p className="mt-2 text-sm text-muted">
                Базовый обмен (BMR) ~{result.bmr} ккал · без цели ~{result.tdee}{" "}
                ккал
              </p>
              <p className="mt-1 text-xs text-muted">
                {result.mode === "lose"
                  ? "С учётом мягкого дефицита для снижения веса"
                  : result.mode === "gain"
                    ? "С небольшим профицитом для набора"
                    : "Для поддержания текущего веса"}
              </p>
            </div>
            <a
              href={NUTRITION_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent/40 hover:bg-accent-soft"
            >
              Гайд по питанию
              <span className="text-xs font-medium text-accent">↗</span>
            </a>
          </div>
        )}
      </section>

      {/* —— Дневной учёт —— */}
      {result && (
        <section className="rounded-[1.5rem] border border-line bg-card/80 p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-semibold tracking-tight">
                Сегодня
              </h3>
              <p className="mt-1 text-xs text-muted">
                {formatTodayRu()} · с новым днём счётчик обнулится сам
              </p>
              <p className="mt-1 text-xs text-muted">
                {over > 0
                  ? `Сверх ориентира на ${over} ккал`
                  : `Осталось ${left} ккал из ${goal}`}
              </p>
            </div>
            <p className="font-display text-3xl font-semibold tabular-nums text-foreground">
              {todayKcal}
              <span className="text-base font-medium text-muted">/{goal}</span>
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
            <div
              className={`h-full rounded-full transition-all ${
                over > 0 ? "bg-blush" : "bg-accent"
              }`}
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {MEAL_OPTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMeal(m.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  meal === m.id
                    ? "bg-accent text-[var(--on-accent)]"
                    : "border border-line text-muted hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <input
              type="range"
              min={50}
              max={1200}
              step={10}
              value={kcal}
              onChange={(e) => setKcal(Number(e.target.value))}
              className="maya-noise-range flex-1"
            />
            <p className="font-display w-16 text-right text-2xl font-semibold tabular-nums">
              {kcal}
            </p>
          </div>

          <input
            value={food}
            onChange={(e) => setFood(e.target.value)}
            placeholder="Что ели? (по желанию)"
            className="mt-3 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm text-foreground"
          />

          <button
            type="button"
            onClick={logMeal}
            className="mt-3 w-full rounded-2xl bg-accent py-3 text-sm font-semibold text-[var(--on-accent)]"
          >
            Записать {kcal} ккал
          </button>
          {flash && (
            <p className="maya-msg-in mt-2 text-center text-sm font-medium text-accent">
              Записано
            </p>
          )}
        </section>
      )}
    </div>
  );
}
