"use client";

import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";
import {
  emptyChildProfile,
  parseRuNumber,
  validateBirthHeight,
  validateBirthWeight,
  validateCurrentHeight,
  validateCurrentWeight,
} from "@/lib/children";
import { compressImageFile } from "@/lib/image";
import { authFetchErrorMessage } from "@/lib/auth-fetch-error";
import { trackEvent } from "@/lib/analytics-client";
import { useAppStore } from "@/lib/store";
import type { ChildProfile, Sex } from "@/lib/types";
import {
  SketchMaya,
} from "@/components/illustrations/MayaSketch";
import {
  dueDateFromLmp,
} from "@/lib/pregnancy";
import {
  clearOnboardingProgress,
  loadOnboardingProgress,
  saveOnboardingProgress,
} from "@/lib/onboarding-progress";
import { restoreCloudBackup } from "@/components/CloudBackupSync";
import {
  isSubscriptionActive,
  PAID_ONLY,
  TEMP_UNLOCK_ALL,
} from "@/lib/subscription";
import { getValuePitch } from "@/lib/value-pitch";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { ValuePitchVisual } from "@/components/ValuePitchVisual";
import { useRouter } from "next/navigation";

type FlowStep =
  | "who"
  | "preg"
  | "baby1"
  | "baby2"
  | "value"
  | "email"
  | "finish";

type Draft = {
  name: string;
  namePending: boolean;
  photoData?: string;
  birthHeight: string;
  birthWeight: string;
  currentHeight: string;
  currentWeight: string;
  birthDate: string;
  sex: Sex;
  city: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  namePending: false,
  photoData: undefined,
  birthHeight: "",
  birthWeight: "",
  currentHeight: "",
  currentWeight: "",
  birthDate: "",
  sex: "unknown",
  city: "",
});

function buildFlow(
  mode: "first" | "add",
  pregnant: boolean,
  hasChild: boolean,
): FlowStep[] {
  if (mode === "add") return ["baby1", "baby2", "finish"];
  const steps: FlowStep[] = ["who"];
  if (pregnant) steps.push("preg");
  if (hasChild) steps.push("baby1", "baby2");
  steps.push("email", "value");
  return steps;
}

function LineField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  error,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  error?: string | null;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <div className="relative mt-1 border-b border-line focus-within:border-accent">
        <input
          value={value}
          disabled={disabled}
          inputMode={inputMode}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent py-2.5 pr-8 text-[17px] text-foreground outline-none placeholder:text-muted/50 disabled:opacity-40"
        />
        {value && !disabled && (
          <button
            type="button"
            aria-label="Очистить"
            onClick={() => onChange("")}
            className="absolute right-0 top-1/2 -translate-y-1/2 px-1 text-muted hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>
      {error && (
        <p className="maya-msg-in mt-1.5 text-[12px] leading-snug text-blush">
          {error}
        </p>
      )}
    </label>
  );
}

export function OnboardingFlow({
  mode = "first",
  onClose,
}: {
  mode?: "first" | "add";
  onClose?: () => void;
}) {
  const addChild = useAppStore((s) => s.addChild);
  const setProfile = useAppStore((s) => s.setProfile);
  const activeChildId = useAppStore((s) => s.activeChildId);
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const childrenCount = useAppStore((s) => s.children.length);
  const setAccountEmail = useAppStore((s) => s.setAccountEmail);
  const accountEmail = useAppStore((s) => s.accountEmail);
  const emailVerified = useAppStore((s) => s.emailVerified);
  const router = useRouter();

  const setPregnancy = useAppStore((s) => s.setPregnancy);
  const enablePregnancyModules = useAppStore((s) => s.enablePregnancyModules);
  const enableCycleModule = useAppStore((s) => s.enableCycleModule);

  const [isPregnant, setIsPregnant] = useState(false);
  const [hasChild, setHasChild] = useState(mode === "add");
  const [trackCycle, setTrackCycle] = useState(false);
  const [pregDue, setPregDue] = useState("");
  const [pregLmp, setPregLmp] = useState("");
  const [pregStartWeight, setPregStartWeight] = useState("");

  const flow = useMemo(
    () => buildFlow(mode, isPregnant, hasChild),
    [mode, isPregnant, hasChild],
  );
  const [stepIdx, setStepIdx] = useState(0);
  const flowStep = flow[Math.min(stepIdx, flow.length - 1)]!;

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedInSession, setSavedInSession] = useState(0);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailOk, setEmailOk] = useState(false);
  const [password, setPassword] = useState("");
  /** register | login | recover */
  const [authMode, setAuthMode] = useState<"register" | "login" | "recover">(
    "register",
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const isFirstSave = useRef(mode === "first");
  const babySaved = useRef(false);
  /** Не перезаписывать localStorage пустым черновиком до восстановления */
  const [progressReady, setProgressReady] = useState(false);
  const [canPersist, setCanPersist] = useState(false);
  const restoredStep = useRef<string | null>(null);

  // Восстановить анкету после Mail.ru / перезагрузки
  useEffect(() => {
    const saved = loadOnboardingProgress(mode);
    if (saved) {
      setIsPregnant(saved.isPregnant);
      setHasChild(saved.hasChild);
      setTrackCycle(saved.trackCycle);
      setPregDue(saved.pregDue || "");
      setPregLmp(saved.pregLmp || "");
      setPregStartWeight(saved.pregStartWeight || "");
      setDraft({
        ...emptyDraft(),
        ...saved.draft,
        sex: saved.draft.sex || "unknown",
      });
      restoredStep.current = saved.step;
    }
    setProgressReady(true);
  }, [mode]);

  // После сборки flow — встать на сохранённый шаг; почту пропустить, если уже вошли
  useEffect(() => {
    if (!progressReady) return;
    const key = restoredStep.current;
    if (key) {
      let idx = flow.indexOf(key as FlowStep);
      if (key === "finish") {
        idx = flow.indexOf("value");
      }
      if (idx < 0) idx = 0;
      if (flow[idx] === "email" && emailVerified) {
        idx = Math.min(idx + 1, flow.length - 1);
      }
      setStepIdx(idx);
      restoredStep.current = null;
    }
    setCanPersist(true);
  }, [progressReady, flow, emailVerified]);

  // Если вошли через Mail.ru прямо на шаге email — сразу дальше
  useEffect(() => {
    if (!canPersist) return;
    if (flowStep === "email" && emailVerified) {
      setEmailOk(true);
      setStepIdx((i) => {
        const emailIdx = flow.indexOf("email");
        if (emailIdx < 0 || i !== emailIdx) return i;
        return Math.min(emailIdx + 1, flow.length - 1);
      });
    }
  }, [emailVerified, flowStep, flow, canPersist]);

  useEffect(() => {
    setStepIdx((i) => Math.min(i, Math.max(0, flow.length - 1)));
  }, [flow.length]);

  // Автосохранение прогресса
  useEffect(() => {
    if (!canPersist || mode !== "first") return;
    saveOnboardingProgress({
      v: 1,
      mode,
      step: flowStep,
      isPregnant,
      hasChild,
      trackCycle,
      pregDue,
      pregLmp,
      pregStartWeight,
      draft,
      updatedAt: Date.now(),
    });
  }, [
    canPersist,
    mode,
    flowStep,
    isPregnant,
    hasChild,
    trackCycle,
    pregDue,
    pregLmp,
    pregStartWeight,
    draft,
  ]);

  const progress = stepIdx + 1;
  const totalProgress = flow.length;

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  async function onPhoto(file: File | null) {
    if (!file) return;
    try {
      const data = await compressImageFile(file, 480, 0.72);
      patch({ photoData: data });
    } catch {
      /* ignore */
    }
  }

  function validateStep2(): boolean {
    const next: Record<string, string> = {};
    if (!draft.namePending && !draft.name.trim()) {
      next.name = "Укажите имя или включите «ещё не выбрали»";
    }
    const bh = parseRuNumber(draft.birthHeight);
    const bw = parseRuNumber(draft.birthWeight);
    const ch = parseRuNumber(draft.currentHeight);
    const cw = parseRuNumber(draft.currentWeight);

    if (draft.birthHeight.trim()) {
      const e = bh == null ? "Число в см" : validateBirthHeight(bh);
      if (e) next.birthHeight = e;
    }
    if (draft.birthWeight.trim()) {
      const e = bw == null ? "Число в кг" : validateBirthWeight(bw);
      if (e) next.birthWeight = e;
    }
    if (draft.currentHeight.trim()) {
      const e = ch == null ? "Число в см" : validateCurrentHeight(ch);
      if (e) next.currentHeight = e;
    }
    if (draft.currentWeight.trim()) {
      const e = cw == null ? "Число в кг" : validateCurrentWeight(cw);
      if (e) next.currentWeight = e;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateWho(): boolean {
    if (!isPregnant && !hasChild && !trackCycle) {
      setErrors({ who: "Выберите хотя бы один вариант" });
      return false;
    }
    setErrors({});
    return true;
  }

  function validatePreg(): boolean {
    const next: Record<string, string> = {};
    let due = pregDue.trim();
    if (!due && pregLmp.trim()) {
      due = dueDateFromLmp(pregLmp) || "";
      if (due) setPregDue(due);
    }
    if (!due) next.pregDue = "Укажите ПДР или дату последних месячных";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildProfile(id: string): ChildProfile {
    return emptyChildProfile({
      id,
      name: draft.namePending ? "" : draft.name.trim(),
      namePending: draft.namePending || (!hasChild && isPregnant),
      photoData: draft.photoData,
      birthDate: draft.birthDate,
      sex: draft.sex,
      city: "",
      birthHeightCm: parseRuNumber(draft.birthHeight) ?? undefined,
      birthWeightKg: parseRuNumber(draft.birthWeight) ?? undefined,
    });
  }

  function seedCurrentGrowth() {
    const h = parseRuNumber(draft.currentHeight);
    const w = parseRuNumber(draft.currentWeight);
    if (h == null && w == null) return;
    const parts: string[] = [];
    if (h != null) parts.push(`${h} см`);
    if (w != null) parts.push(`${w} кг`);
    addJournalEntry("growth", {
      date: new Date().toISOString().slice(0, 10),
      value: parts.join(", "),
      note: "из анкеты при старте",
      fields: {
        ...(h != null ? { height: h } : {}),
        ...(w != null ? { weight: w } : {}),
      },
    });
  }

  function persistPregnancy() {
    if (trackCycle) enableCycleModule();
    if (!isPregnant) {
      setPregnancy({
        active: false,
        dueDate: "",
        trackCycle: trackCycle || undefined,
      });
      return;
    }
    let due = pregDue.trim();
    if (!due && pregLmp.trim()) due = dueDateFromLmp(pregLmp) || "";
    setPregnancy({
      active: true,
      dueDate: due,
      lmpDate: pregLmp.trim() || undefined,
      startWeightKg: parseRuNumber(pregStartWeight) ?? undefined,
      trackCycle: trackCycle || undefined,
    });
    enablePregnancyModules();
  }

  function persistDraft() {
    const seed = {
      heightCm: parseRuNumber(draft.currentHeight) ?? undefined,
      weightKg: parseRuNumber(draft.currentWeight) ?? undefined,
    };
    if (isFirstSave.current) {
      if (hasChild || mode === "add") {
        setProfile(buildProfile(activeChildId));
        seedCurrentGrowth();
        babySaved.current = true;
      } else {
        // Беременность и/или цикл без ребёнка — плейсхолдер профиля
        setProfile(
          emptyChildProfile({
            id: activeChildId,
            namePending: true,
            name: "",
          }),
        );
      }
      isFirstSave.current = false;
    } else {
      addChild(buildProfile(`child-${Date.now()}`), { seedGrowth: seed });
      babySaved.current = true;
    }
    setSavedInSession((n) => n + 1);
  }

  function goNext() {
    if (flowStep === "who" && !validateWho()) return;
    if (flowStep === "preg" && !validatePreg()) return;
    if (flowStep === "baby1" && !validateStep2()) return;
    if (flowStep === "email" && !(emailOk || emailVerified)) {
      setEmailError("Подтвердите почту — без неё не сохранить данные и круг мам");
      return;
    }
    setStepIdx((s) => Math.min(flow.length - 1, s + 1));
  }

  function goBack() {
    setErrors({});
    setEmailError(null);
    if (mode === "add" && stepIdx <= 0) {
      onClose?.();
      return;
    }
    setStepIdx((s) => Math.max(0, s - 1));
  }

  async function sendCode() {
    setEmailError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Укажите нормальную почту");
      return;
    }
    setEmailBusy(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось отправить код");
      setCodeSent(true);
    } catch (e) {
      setEmailError(authFetchErrorMessage(e, "Ошибка отправки"));
    } finally {
      setEmailBusy(false);
    }
  }

  async function verifyCode() {
    setEmailError(null);
    const trimmed = email.trim().toLowerCase();
    setEmailBusy(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, code }),
      });
      const data = (await res.json()) as { error?: string; email?: string };
      if (!res.ok) throw new Error(data.error || "Неверный код");
      setAccountEmail(data.email || trimmed);
      setEmailOk(true);
      trackEvent(authMode === "register" ? "register" : "login");
      if (password.length >= 6) {
        await fetch("/api/auth/password", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set", password }),
        });
      }
      if (authMode === "login" || authMode === "recover") {
        await restoreCloudBackup({ force: true });
        completeOnboarding();
        onClose?.();
        if (
          mode === "first" &&
          PAID_ONLY &&
          !isSubscriptionActive(useAppStore.getState().subscription)
        ) {
          router.replace("/pricing");
        }
        return;
      }
      setStepIdx((i) => Math.min(flow.length - 1, i + 1));
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Ошибка проверки");
    } finally {
      setEmailBusy(false);
    }
  }

  function switchAuthMode(next: "register" | "login" | "recover") {
    setAuthMode(next);
    setCodeSent(false);
    setCode("");
    setPassword("");
    setEmailError(null);
  }

  async function loginPassword() {
    setEmailError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Укажите почту");
      return;
    }
    setEmailBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: trimmed,
          password,
        }),
      });
      const data = (await res.json()) as { error?: string; email?: string };
      if (!res.ok) throw new Error(data.error || "Неверный пароль");
      setAccountEmail(data.email || trimmed);
      setEmailOk(true);
      trackEvent("login");
      await restoreCloudBackup({ force: true });
      completeOnboarding();
      onClose?.();
      if (
        mode === "first" &&
        PAID_ONLY &&
        !isSubscriptionActive(useAppStore.getState().subscription)
      ) {
        router.replace("/pricing");
      }
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setEmailBusy(false);
    }
  }

  async function finish(andAddAnother: boolean) {
    if (mode === "first" && !(emailOk || emailVerified)) {
      setEmailError("Сначала подтвердите почту");
      setSaving(false);
      return;
    }
    setSaving(true);
    try {
      persistPregnancy();
      if (hasChild || mode === "add") {
        persistDraft();
      } else if (isFirstSave.current) {
        persistDraft();
      }
      if (andAddAnother) {
        setDraft(emptyDraft());
        setErrors({});
        setHasChild(true);
        setStepIdx(flow.indexOf("baby1") >= 0 ? flow.indexOf("baby1") : 0);
      } else {
        trackEvent("onboarding_done");
        clearOnboardingProgress();
        completeOnboarding();
        onClose?.();
        if (mode === "first" && PAID_ONLY && !TEMP_UNLOCK_ALL) {
          router.replace("/pricing");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  const titleName =
    draft.namePending || !draft.name.trim() ? "Малыш" : draft.name.trim();

  const valuePitch = useMemo(
    () =>
      getValuePitch({
        pregnant: isPregnant,
        hasChild,
        trackCycle,
      }),
    [isPregnant, hasChild, trackCycle],
  );

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background text-foreground">
      {mode === "add" && (
        <div
          className="absolute inset-0 bg-[color-mix(in_oklab,var(--background)_92%,#000)]"
          aria-hidden
        />
      )}
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse at 30% 0%, rgba(50,215,175,0.16), transparent 50%), radial-gradient(ellipse at 90% 20%, rgba(64,120,255,0.12), transparent 45%)",
        }}
      />

      <div className="relative mx-auto flex h-full w-full max-w-lg flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {mode === "add" && (
          <button
            type="button"
            onClick={() => onClose?.()}
            className="mb-3 self-end rounded-xl border border-line bg-card/80 px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            Закрыть
          </button>
        )}
        <div className="mb-5 flex gap-1.5">
          {Array.from({ length: totalProgress }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < progress ? "bg-accent" : "bg-line"
              }`}
            />
          ))}
        </div>

        <div className="mb-4 flex items-center gap-2">
          {(stepIdx > 0 || mode === "add") && (
            <button
              type="button"
              onClick={goBack}
              className="rounded-xl border border-line px-3 py-1.5 text-sm text-muted hover:text-foreground"
            >
              ←
            </button>
          )}
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            шаг {progress} из {totalProgress}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {flowStep === "who" && (
            <div className="maya-rise space-y-5 py-4">
              <div className="text-center">
                <SketchMaya className="mx-auto mb-2 h-20 w-20" />
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  Кто вы?
                </h1>
                <p className="mt-1.5 text-sm text-muted">
                  Можно выбрать оба варианта
                </p>
              </div>
              {(
                [
                  {
                    key: "preg" as const,
                    on: isPregnant,
                    toggle: () => setIsPregnant((v) => !v),
                    title: "Я беременна",
                    sub: "Недели, схватки, шевеления, визиты",
                  },
                  {
                    key: "child" as const,
                    on: hasChild,
                    toggle: () => setHasChild((v) => !v),
                    title: "У меня есть ребёнок",
                    sub: "Дневники, чат и рост малыша",
                  },
                  {
                    key: "cycle" as const,
                    on: trackCycle,
                    toggle: () => setTrackCycle((v) => !v),
                    title: "Слежу за своим циклом",
                    sub: "Трекер цикла и самочувствия",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={opt.toggle}
                  className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                    opt.on
                      ? "border-accent bg-accent-soft/60"
                      : "border-line bg-card/60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-semibold ${
                        opt.on ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {opt.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{opt.sub}</p>
                  </div>
                  {opt.on && (
                    <span className="mt-0.5 text-accent" aria-hidden>
                      ✓
                    </span>
                  )}
                </button>
              ))}
              {errors.who && (
                <p className="text-sm text-blush">{errors.who}</p>
              )}
              {mode === "first" && (
                <button
                  type="button"
                  onClick={() => {
                    switchAuthMode("login");
                    const idx = flow.indexOf("email");
                    if (idx >= 0) setStepIdx(idx);
                  }}
                  className="w-full pt-1 text-center text-sm text-accent underline underline-offset-2"
                >
                  Уже есть аккаунт? Войти
                </button>
              )}
            </div>
          )}

          {flowStep === "preg" && (
            <div className="maya-rise space-y-5">
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  О беременности
                </h1>
                <p className="mt-1.5 text-sm text-muted">
                  По ПДР или дате месячных Мая посчитает неделю
                </p>
              </div>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Предполагаемая дата родов (ПДР)
                </span>
                <input
                  type="date"
                  value={pregDue}
                  onChange={(e) => setPregDue(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-card/70 px-3 py-3 text-sm"
                />
                {errors.pregDue && (
                  <p className="mt-1.5 text-xs text-blush">{errors.pregDue}</p>
                )}
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Или первый день последних месячных
                </span>
                <input
                  type="date"
                  value={pregLmp}
                  onChange={(e) => setPregLmp(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-card/70 px-3 py-3 text-sm"
                />
              </label>
              <LineField
                label="Вес до беременности (кг), необязательно"
                value={pregStartWeight}
                onChange={setPregStartWeight}
                inputMode="decimal"
                placeholder="например 60"
              />
            </div>
          )}

          {flowStep === "baby1" && (
            <div className="maya-rise space-y-5">
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  Данные ребёнка
                </h1>
                <p className="mt-1.5 text-sm text-muted">
                  Персонализируем приложение по этим данным
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-accent/50 bg-accent-soft/40"
                >
                  {draft.photoData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={draft.photoData}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      className="text-accent"
                      aria-hidden
                    >
                      <path d="M4 8.5h3l1.2-2h7.6l1.2 2H20a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z" />
                      <circle cx="12" cy="13.5" r="3.2" />
                    </svg>
                  )}
                </button>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                    Добавьте фото
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted">
                    Можно пропустить
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
                />
              </div>

              <LineField
                label="Имя"
                value={draft.name}
                disabled={draft.namePending}
                onChange={(name) => patch({ name })}
                placeholder="Например: Соня"
                error={errors.name}
              />

              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card/60 px-3 py-2.5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Ещё не выбрали
                  </p>
                  <p className="text-xs text-muted">Будем звать «малыш»</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.namePending}
                  onClick={() =>
                    patch({
                      namePending: !draft.namePending,
                      name: !draft.namePending ? "" : draft.name,
                    })
                  }
                  className={`relative h-7 w-12 rounded-full transition ${
                    draft.namePending ? "bg-accent" : "bg-line"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
                      draft.namePending ? "left-[1.35rem]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              <LineField
                label="Рост при рождении (см)"
                value={draft.birthHeight}
                onChange={(birthHeight) => patch({ birthHeight })}
                inputMode="decimal"
                placeholder="например 52"
                error={errors.birthHeight}
              />
              <LineField
                label="Вес при рождении (кг)"
                value={draft.birthWeight}
                onChange={(birthWeight) => patch({ birthWeight })}
                inputMode="decimal"
                placeholder="например 3.4"
                error={errors.birthWeight}
              />
              <LineField
                label="Рост сейчас (см)"
                value={draft.currentHeight}
                onChange={(currentHeight) => patch({ currentHeight })}
                inputMode="decimal"
                placeholder="например 68"
                error={errors.currentHeight}
              />
              <LineField
                label="Вес сейчас (кг)"
                value={draft.currentWeight}
                onChange={(currentWeight) => patch({ currentWeight })}
                inputMode="decimal"
                placeholder="например 8.2"
                error={errors.currentWeight}
              />
            </div>
          )}

          {flowStep === "baby2" && (
            <div className="maya-rise space-y-5">
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  Ещё чуть-чуть
                </h1>
                <p className="mt-1.5 text-sm text-muted">
                  Дата рождения — для норм роста. Погоду Мая берёт по геолокации.
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Дата рождения
                </p>
                <input
                  type="date"
                  value={draft.birthDate}
                  onChange={(e) => patch({ birthDate: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-line bg-card/70 px-3 py-3 text-sm"
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Пол
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["girl", "Девочка"],
                      ["boy", "Мальчик"],
                      ["unknown", "Пока нет"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => patch({ sex: id })}
                      className={`rounded-xl border py-3 text-sm font-semibold ${
                        draft.sex === id
                          ? "border-accent/40 bg-accent-soft text-foreground"
                          : "border-line bg-card/50 text-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {flowStep === "value" && (
            <div className="maya-rise space-y-4 py-1">
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                  {valuePitch.eyebrow}
                </p>
                <h1 className="font-display mt-1.5 text-3xl font-semibold tracking-tight">
                  {valuePitch.title}
                </h1>
              </div>
              <ValuePitchVisual
                hello={valuePitch.hello}
                pluses={valuePitch.pluses}
              />
              <ul className="space-y-2">
                {valuePitch.pluses.slice(0, 4).map((plus) => (
                  <li
                    key={plus.text}
                    className="flex items-start gap-2.5 rounded-2xl border border-line/80 bg-card/50 px-3 py-2.5"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <MayaIcon name={plus.icon} size={14} />
                    </span>
                    <span className="text-sm leading-snug text-foreground/90">
                      {plus.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {flowStep === "email" && (
            <div className="maya-rise flex h-full flex-col justify-center py-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                {authMode === "register"
                  ? "Регистрация"
                  : authMode === "login"
                    ? "Вход"
                    : "Восстановление"}
              </p>
              <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">
                {authMode === "register"
                  ? "Ваша почта"
                  : authMode === "login"
                    ? "С возвращением"
                    : "Доступ к аккаунту"}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {authMode === "register"
                  ? "Только российская почта (Mail.ru, Яндекс, .ru). Пришлём код в письме."
                  : authMode === "login"
                    ? "Пароль, если задавали. Или код на почту."
                    : "Код на почту, затем новый пароль."}
              </p>

              {(emailOk || emailVerified) && (
                <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
                  Почта подтверждена
                  {accountEmail ? `: ${accountEmail}` : ""}
                </p>
              )}

              {!(emailOk || emailVerified) && (
                <div className="mt-6 space-y-3">
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Email
                    </span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@mail.ru"
                      className="mt-1 w-full rounded-xl border border-line bg-card/70 px-3 py-3 text-sm outline-none focus:border-accent/50"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Пароль
                    </span>
                    <input
                      type="password"
                      autoComplete={
                        authMode === "login" ? "current-password" : "new-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        authMode === "login"
                          ? "Если задавали — войти без кода"
                          : "От 6 символов (можно задать после кода)"
                      }
                      className="mt-1 w-full rounded-xl border border-line bg-card/70 px-3 py-3 text-sm outline-none focus:border-accent/50"
                    />
                  </label>

                  {codeSent && (
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                        Код из письма
                      </span>
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        placeholder="6 цифр"
                        className="mt-1 w-full rounded-xl border border-line bg-card/70 px-3 py-3 text-sm tracking-[0.2em] outline-none focus:border-accent/50"
                      />
                    </label>
                  )}

                  {emailError && (
                    <p className="text-sm text-[color-mix(in_oklab,var(--blush)_80%,#900)]">
                      {emailError}
                    </p>
                  )}

                  {!codeSent ? (
                    <div className="space-y-2">
                      {authMode === "login" && password.length >= 6 && (
                        <button
                          type="button"
                          disabled={emailBusy}
                          onClick={() => void loginPassword()}
                          className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] disabled:opacity-50"
                        >
                          {emailBusy ? "Вхожу…" : "Войти по паролю"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={emailBusy}
                        onClick={() => void sendCode()}
                        className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] disabled:opacity-50"
                      >
                        {emailBusy
                          ? "Отправляю…"
                          : authMode === "register"
                            ? "Получить код"
                            : "Получить код для входа"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={emailBusy || code.length < 6}
                        onClick={() => void verifyCode()}
                        className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] disabled:opacity-50"
                      >
                        {emailBusy
                          ? "Проверяю…"
                          : authMode === "register"
                            ? "Подтвердить"
                            : "Войти"}
                      </button>
                      <button
                        type="button"
                        disabled={emailBusy}
                        onClick={() => void sendCode()}
                        className="w-full text-sm text-muted underline"
                      >
                        Отправить код ещё раз
                      </button>
                    </div>
                  )}


                  <div className="flex flex-col gap-2 pt-2 text-center text-sm">
                    {authMode === "register" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => switchAuthMode("login")}
                          className="text-accent underline underline-offset-2"
                        >
                          Уже есть аккаунт? Войти
                        </button>
                        <button
                          type="button"
                          onClick={() => switchAuthMode("recover")}
                          className="text-muted underline underline-offset-2"
                        >
                          Забыли пароль?
                        </button>
                      </>
                    ) : authMode === "login" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => switchAuthMode("register")}
                          className="text-accent underline underline-offset-2"
                        >
                          Нет аккаунта? Зарегистрироваться
                        </button>
                        <button
                          type="button"
                          onClick={() => switchAuthMode("recover")}
                          className="text-muted underline underline-offset-2"
                        >
                          Забыли пароль?
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => switchAuthMode("login")}
                        className="text-accent underline underline-offset-2"
                      >
                        ← Назад ко входу
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {flowStep === "finish" && (
            <div className="maya-rise flex h-full flex-col justify-center py-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                Готово
              </p>
              <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">
                {isPregnant && !hasChild
                  ? "Беременность в Мае"
                  : trackCycle && !hasChild && !isPregnant
                    ? "Цикл в Мае"
                    : `${titleName} в Мае`}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {mode === "add"
                  ? "Ребёнок сохранён. Можно сразу добавить ещё одного или вернуться в Маю."
                  : PAID_ONLY && !TEMP_UNLOCK_ALL
                    ? "Анкета готова. Дальше — выбрать период доступа: после оплаты откроются Мая, дневники и общение."
                    : isPregnant && !hasChild
                    ? "Открыли недели, схватки и сон мамы. После родов добавите малыша в профиле."
                    : trackCycle && !hasChild && !isPregnant
                      ? "Трекер цикла готов. Можно писать Мае про самочувствие."
                      : isPregnant && hasChild
                        ? "И беременность, и малыш — Мая будет в курсе обоих контекстов."
                        : "Всё готово — можно начинать. Ещё одного ребёнка добавите позже в профиле."}
              </p>
              {accountEmail && (
                <p className="mt-2 text-xs text-muted">Аккаунт: {accountEmail}</p>
              )}
              <p className="mt-4 text-xs text-muted">
                Сейчас в Мае детей: {childrenCount}
                {savedInSession > 0
                  ? ` · в этой анкете сохранили: ${savedInSession}`
                  : ""}
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 pt-2">
          {flowStep !== "finish" && flowStep !== "email" && flowStep !== "value" ? (
            <button
              type="button"
              onClick={goNext}
              className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] hover:bg-accent-hot"
            >
              {flowStep === "who" ? "Продолжить" : "Далее"}
            </button>
          ) : null}

          {flowStep === "value" ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void finish(false)}
              className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] hover:bg-accent-hot disabled:opacity-50"
            >
              {TEMP_UNLOCK_ALL ? "Начать с Маей" : "Выбрать тариф"}
            </button>
          ) : null}

          {flowStep === "email" && (
            <>
              {(emailOk || emailVerified) && (
                <button
                  type="button"
                  onClick={goNext}
                  className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] hover:bg-accent-hot"
                >
                  Далее
                </button>
              )}
            </>
          )}

          {flowStep === "finish" && (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => void finish(false)}
                className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] hover:bg-accent-hot disabled:opacity-50"
              >
                {mode === "add"
                  ? "Сохранить ребёнка"
                  : "Начать с Маей"}
              </button>
              {mode === "add" && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void finish(true)}
                  className="w-full rounded-2xl border border-line bg-card/70 py-3.5 text-sm font-semibold text-foreground disabled:opacity-50"
                >
                  Сохранить и добавить ещё
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
