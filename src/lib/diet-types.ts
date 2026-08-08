export type DietActivity =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type DietSex = "female" | "male";

export type DietGoalMode = "lose" | "maintain" | "gain";

/** План диеты мамы (общий на всех детей) */
export type DietPlan = {
  heightCm: number;
  weightKg: number;
  ageYears: number;
  sex: DietSex;
  activity: DietActivity;
  /** Снижение / поддержание / набор */
  goalMode: DietGoalMode;
  /** Желаемый вес, кг (опционально) */
  targetWeightKg?: number;
  dailyKcalOverride?: number | null;
  updatedAt: string;
};

export type DietMeal = "breakfast" | "lunch" | "dinner" | "snack";
