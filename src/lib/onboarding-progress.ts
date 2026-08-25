/** Черновик онбординга — переживает уход на Mail.ru OAuth и перезагрузку. */

export type OnboardingDraftPersist = {
  v: 1;
  mode: "first" | "add";
  step: string;
  isPregnant: boolean;
  hasChild: boolean;
  trackCycle: boolean;
  pregDue: string;
  pregLmp: string;
  pregStartWeight: string;
  draft: {
    name: string;
    namePending: boolean;
    photoData?: string;
    birthHeight: string;
    birthWeight: string;
    currentHeight: string;
    currentWeight: string;
    birthDate: string;
    sex: "girl" | "boy" | "unknown";
    city: string;
  };
  updatedAt: number;
};

const KEY = "maya-onboarding-progress-v1";

export function loadOnboardingProgress(
  mode: "first" | "add",
): OnboardingDraftPersist | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as OnboardingDraftPersist;
    if (!data || data.v !== 1 || data.mode !== mode) return null;
    // старше 7 дней — выбросить
    if (Date.now() - (data.updatedAt || 0) > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function saveOnboardingProgress(data: OnboardingDraftPersist): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, updatedAt: Date.now() }));
  } catch {
    /* quota / private mode */
  }
}

export function clearOnboardingProgress(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
