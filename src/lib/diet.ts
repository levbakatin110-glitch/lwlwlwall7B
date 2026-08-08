import type {
  DietActivity,
  DietGoalMode,
  DietPlan,
  DietSex,
} from "./diet-types";

export const ACTIVITY_OPTIONS: {
  id: DietActivity;
  label: string;
  factor: number;
}[] = [
  {
    id: "sedentary",
    label: "Минимальная (сидячий день)",
    factor: 1.2,
  },
  {
    id: "light",
    label: "Лёгкая активность (прогулки, домашние дела)",
    factor: 1.375,
  },
  {
    id: "moderate",
    label: "Средняя (тренировки 3–5 раз в неделю)",
    factor: 1.55,
  },
  {
    id: "active",
    label: "Высокая (почти ежедневные тренировки)",
    factor: 1.725,
  },
  {
    id: "very_active",
    label: "Очень высокая (тяжёлая нагрузка)",
    factor: 1.9,
  },
];

export const GOAL_OPTIONS: {
  id: DietGoalMode;
  label: string;
}[] = [
  { id: "lose", label: "Снижение" },
  { id: "maintain", label: "Поддержание" },
  { id: "gain", label: "Набор" },
];

export const MEAL_OPTIONS = [
  { id: "breakfast" as const, label: "Завтрак" },
  { id: "lunch" as const, label: "Обед" },
  { id: "dinner" as const, label: "Ужин" },
  { id: "snack" as const, label: "Перекус" },
];

const MIN_KCAL: Record<DietSex, number> = {
  female: 1200,
  male: 1500,
};

/** Mifflin–St Jeor */
export function calcBmr(input: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: DietSex;
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  return Math.round(input.sex === "female" ? base - 161 : base + 5);
}

export function activityFactor(activity: DietActivity): number {
  return ACTIVITY_OPTIONS.find((a) => a.id === activity)?.factor ?? 1.2;
}

export function calcTdee(bmr: number, activity: DietActivity): number {
  return Math.round(bmr * activityFactor(activity));
}

export type DietCalc = {
  bmr: number;
  tdee: number;
  targetKcal: number;
  mode: DietGoalMode;
  deficitPerDay: number;
};

export function calcDiet(plan: Pick<
  DietPlan,
  "weightKg" | "heightCm" | "ageYears" | "sex" | "activity" | "goalMode" | "dailyKcalOverride"
>): DietCalc {
  const bmr = calcBmr(plan);
  const tdee = calcTdee(bmr, plan.activity);
  const floor = MIN_KCAL[plan.sex];
  const mode = plan.goalMode || "maintain";

  let targetKcal = tdee;
  let deficitPerDay = 0;

  if (mode === "lose") {
    targetKcal = Math.max(floor, tdee - 400);
    deficitPerDay = tdee - targetKcal;
  } else if (mode === "gain") {
    targetKcal = tdee + 300;
    deficitPerDay = -300;
  }

  if (plan.dailyKcalOverride != null && plan.dailyKcalOverride > 0) {
    targetKcal = Math.round(plan.dailyKcalOverride);
    deficitPerDay = tdee - targetKcal;
  }

  return { bmr, tdee, targetKcal, mode, deficitPerDay };
}

export function isDietPlanReady(
  plan: DietPlan | null | undefined,
): plan is DietPlan {
  if (!plan) return false;
  return (
    Number.isFinite(plan.heightCm) &&
    plan.heightCm >= 130 &&
    plan.heightCm <= 220 &&
    Number.isFinite(plan.weightKg) &&
    plan.weightKg >= 35 &&
    plan.weightKg <= 250 &&
    Number.isFinite(plan.ageYears) &&
    plan.ageYears >= 14 &&
    plan.ageYears <= 80 &&
    Boolean(plan.goalMode)
  );
}

export function emptyDietDraft(): Omit<DietPlan, "updatedAt"> {
  return {
    heightCm: 165,
    weightKg: 70,
    ageYears: 28,
    sex: "female",
    activity: "light",
    goalMode: "maintain",
    targetWeightKg: undefined,
    dailyKcalOverride: null,
  };
}

export function isDietLikeModule(
  moduleId: string,
  title?: string,
  description?: string,
): boolean {
  if (moduleId === "diet") return true;
  const t = `${title || ""} ${description || ""}`;
  return /диет|калор|похуд|ккал/i.test(t);
}
