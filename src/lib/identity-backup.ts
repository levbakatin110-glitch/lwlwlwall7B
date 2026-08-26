/** Лёгкий «паспорт» сессии — cookie + ключ, если основной стор пустой. */

export type MayaIdentity = {
  v: 1;
  onboardingDone: boolean;
  email: string | null;
  emailVerified: boolean;
  childName?: string;
  updatedAt: number;
};

const LS_KEY = "maya-identity-v1";
const COOKIE = "maya_id";
/** Отдельный флаг «анкета уже пройдена» — не сбрасывается при сбое стора */
const ONBOARDED_KEY = "maya-onboarded-v1";

function canUseDom() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function markOnboardingDoneSticky(): void {
  if (!canUseDom()) return;
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearOnboardingDoneSticky(): void {
  if (!canUseDom()) return;
  try {
    localStorage.removeItem(ONBOARDED_KEY);
  } catch {
    /* ignore */
  }
}

export function readOnboardingDoneSticky(): boolean {
  if (!canUseDom()) return false;
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return false;
  }
}

export function readIdentityBackup(): MayaIdentity | null {
  if (!canUseDom()) return null;

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as MayaIdentity;
      if (data?.v === 1) return data;
    }
  } catch {
    /* ignore */
  }

  try {
    const match = document.cookie.match(/(?:^|; )maya_id=([^;]*)/);
    if (!match?.[1]) return null;
    const decoded = decodeURIComponent(match[1]);
    const [flag, email, verified] = decoded.split("|");
    if (flag !== "1" && flag !== "0") return null;
    return {
      v: 1,
      onboardingDone: flag === "1",
      email: email && email !== "-" ? email : null,
      emailVerified: verified === "1",
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeIdentityBackup(input: {
  onboardingDone: boolean;
  email: string | null;
  emailVerified: boolean;
  childName?: string;
}): void {
  if (!canUseDom()) return;

  const data: MayaIdentity = {
    v: 1,
    onboardingDone: input.onboardingDone,
    email: input.email ? input.email.trim().toLowerCase() : null,
    emailVerified: input.emailVerified,
    childName: input.childName?.trim() || undefined,
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }

  try {
    const email = data.email || "-";
    const value = encodeURIComponent(
      `${data.onboardingDone ? "1" : "0"}|${email}|${data.emailVerified ? "1" : "0"}`,
    );
    // 400 дней — как «постоянный» вход на том же сайте / PWA
    document.cookie = `${COOKIE}=${value}; path=/; max-age=34560000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function clearIdentityBackup(): void {
  if (!canUseDom()) return;
  clearOnboardingDoneSticky();
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}
