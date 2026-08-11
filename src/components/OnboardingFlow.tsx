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
import { trackEvent } from "@/lib/analytics-client";
import { useAppStore } from "@/lib/store";
import type { ChildProfile, Sex } from "@/lib/types";
import {
  SketchBaby,
  SketchMaya,
  SketchSprig,
} from "@/components/illustrations/MayaSketch";
import { EmailGate } from "@/components/EmailGate";

const STEPS_FIRST = 5;
const STEPS_ADD = 4;

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

  const lastStep = mode === "first" ? STEPS_FIRST - 1 : STEPS_ADD - 1;
  const [step, setStep] = useState(mode === "add" ? 1 : 0);
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
  const fileRef = useRef<HTMLInputElement>(null);
  const isFirstSave = useRef(mode === "first");

  const progress = useMemo(() => step + 1, [step]);
  const totalProgress = mode === "first" ? STEPS_FIRST : STEPS_ADD;

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

  function buildProfile(id: string): ChildProfile {
    return emptyChildProfile({
      id,
      name: draft.namePending ? "" : draft.name.trim(),
      namePending: draft.namePending,
      photoData: draft.photoData,
      birthDate: draft.birthDate,
      sex: draft.sex,
      city: draft.city.trim(),
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

  function persistDraft() {
    const seed = {
      heightCm: parseRuNumber(draft.currentHeight) ?? undefined,
      weightKg: parseRuNumber(draft.currentWeight) ?? undefined,
    };
    if (isFirstSave.current) {
      setProfile(buildProfile(activeChildId));
      seedCurrentGrowth();
      isFirstSave.current = false;
    } else {
      addChild(buildProfile(`child-${Date.now()}`), { seedGrowth: seed });
    }
    setSavedInSession((n) => n + 1);
  }

  function goNext() {
    if (step === 1 && !validateStep2()) return;
    if (mode === "first" && step === 3 && !emailOk && !emailVerified) {
      setEmailError("Сначала подтвердите почту кодом из письма");
      return;
    }
    setStep((s) => Math.min(lastStep, s + 1));
  }

  function goBack() {
    setErrors({});
    setEmailError(null);
    if (mode === "add" && step <= 1) {
      onClose?.();
      return;
    }
    setStep((s) => Math.max(0, s - 1));
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
      setEmailError(e instanceof Error ? e.message : "Ошибка отправки");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, code }),
      });
      const data = (await res.json()) as { error?: string; email?: string };
      if (!res.ok) throw new Error(data.error || "Неверный код");
      setAccountEmail(data.email || trimmed);
      setEmailOk(true);
      trackEvent("register");
      setStep(4);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Ошибка проверки");
    } finally {
      setEmailBusy(false);
    }
  }

  async function finish(andAddAnother: boolean) {
    if (mode === "first" && !emailOk && !emailVerified) {
      setEmailError("Нужна подтверждённая почта");
      setStep(3);
      return;
    }
    setSaving(true);
    try {
      persistDraft();
      if (andAddAnother) {
        setDraft(emptyDraft());
        setErrors({});
        setStep(1);
      } else {
        completeOnboarding();
        trackEvent("onboarding_done");
        onClose?.();
      }
    } finally {
      setSaving(false);
    }
  }

  const titleName =
    draft.namePending || !draft.name.trim() ? "Малыш" : draft.name.trim();

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse at 30% 0%, rgba(50,215,175,0.16), transparent 50%), radial-gradient(ellipse at 90% 20%, rgba(64,120,255,0.12), transparent 45%)",
        }}
      />

      <div className="relative mx-auto flex h-full w-full max-w-lg flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
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
          {(step > 0 || mode === "add") && (
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
          {step === 0 && (
            <div className="maya-rise relative flex h-full flex-col justify-center py-8">
              <SketchSprig
                tone="soft"
                className="pointer-events-none absolute -right-2 top-4 h-32 w-20 opacity-80"
              />
              <SketchMaya className="mb-2 h-28 w-28" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                Мая
              </p>
              <h1 className="font-display mt-3 text-4xl font-semibold leading-tight tracking-tight">
                Давайте настроим
                <br />
                под вашего малыша
              </h1>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted">
                Имя, рост, вес — и Мая сразу понимает контекст. Можно добавить
                несколько детей: у каждого свои дневники и чат.
              </p>
              <SketchBaby
                tone="soft"
                className="mt-6 h-24 w-28 opacity-90"
              />
            </div>
          )}

          {step === 1 && (
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
                    Для профиля. Можно пропустить.
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

          {step === 2 && (
            <div className="maya-rise space-y-5">
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  Ещё чуть-чуть
                </h1>
                <p className="mt-1.5 text-sm text-muted">
                  Дата рождения — для норм роста. Город определим сами по
                  местоположению — вручную не нужно.
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

          {mode === "first" && step === 3 && (
            <div className="maya-rise flex h-full flex-col justify-center py-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                Регистрация
              </p>
              <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">
                Ваша почта
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Пришлём код подтверждения — так сохранится аккаунт и подписка.
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
                    <button
                      type="button"
                      disabled={emailBusy}
                      onClick={() => void sendCode()}
                      className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] disabled:opacity-50"
                    >
                      {emailBusy ? "Отправляю…" : "Получить код"}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={emailBusy || code.length < 6}
                        onClick={() => void verifyCode()}
                        className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] disabled:opacity-50"
                      >
                        {emailBusy ? "Проверяю…" : "Подтвердить"}
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
                </div>
              )}
            </div>
          )}

          {((mode === "first" && step === 4) ||
            (mode === "add" && step === 3)) && (
            <div className="maya-rise flex h-full flex-col justify-center py-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                Готово
              </p>
              <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">
                {titleName} в Мае
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Можно сразу добавить ещё одного ребёнка — у каждого будут свои
                дневники, гардероб и чат.
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
          {step < lastStep &&
          !(mode === "first" && step === 3 && !(emailOk || emailVerified)) ? (
            <button
              type="button"
              onClick={goNext}
              className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] hover:bg-accent-hot"
            >
              {step === 0 ? "Начать" : "Далее"}
            </button>
          ) : null}

          {mode === "first" &&
            step === 3 &&
            (emailOk || emailVerified) && (
              <button
                type="button"
                onClick={goNext}
                className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] hover:bg-accent-hot"
              >
                Далее
              </button>
            )}

          {step === lastStep && (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => void finish(false)}
                className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] hover:bg-accent-hot disabled:opacity-50"
              >
                {mode === "add" ? "Сохранить ребёнка" : "Начать с Маей"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void finish(true)}
                className="w-full rounded-2xl border border-line bg-card/70 py-3.5 text-sm font-semibold text-foreground disabled:opacity-50"
              >
                Сохранить и добавить ещё
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ВРЕМЕННО открытый доступ (показ коллеге): без анкеты и без почты.
 * Вернуть false, когда нужно снова включить вход.
 */
export const TEMP_OPEN_ACCESS = false;

/** Ждёт persist и показывает онбординг новым пользователям */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const emailVerified = useAppStore((s) => s.emailVerified);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useAppStore.persist.hasHydrated());
    return unsub;
  }, []);

  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-muted">
        <p className="font-display text-lg">Мая…</p>
      </div>
    );
  }

  // Временный просмотр: сразу в приложение
  if (TEMP_OPEN_ACCESS) {
    return <>{children}</>;
  }

  if (!onboardingDone) {
    return <OnboardingFlow mode="first" />;
  }

  // Анкету прошли раньше без почты — всё равно требуем регистрацию
  if (!emailVerified) {
    return <EmailGate>{children}</EmailGate>;
  }

  return <>{children}</>;
}
