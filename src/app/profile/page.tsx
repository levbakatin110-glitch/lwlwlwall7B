"use client";

import { FormEvent, useEffect, useState } from "react";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { childDisplayName } from "@/lib/children";
import { compressImageFile } from "@/lib/image";
import { useAppStore } from "@/lib/store";
import type { ChildProfile } from "@/lib/types";

export default function ProfilePage() {
  const profile = useAppStore((s) => s.profile);
  const children = useAppStore((s) => s.children);
  const activeChildId = useAppStore((s) => s.activeChildId);
  const setProfile = useAppStore((s) => s.setProfile);
  const switchChild = useAppStore((s) => s.switchChild);
  const removeChild = useAppStore((s) => s.removeChild);
  const accountEmail = useAppStore((s) => s.accountEmail);
  const emailVerified = useAppStore((s) => s.emailVerified);
  const setAccountEmail = useAppStore((s) => s.setAccountEmail);
  const [form, setForm] = useState<ChildProfile>(profile);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm(
      profile.name?.trim()
        ? { ...profile, namePending: false }
        : profile,
    );
  }, [profile]);

  async function sendCode() {
    setEmailError(null);
    setEmailMsg(null);
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
      setEmailMsg("Код отправлен — проверьте почту");
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setEmailBusy(false);
    }
  }

  async function verifyCode() {
    setEmailError(null);
    setEmailMsg(null);
    setEmailBusy(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
        }),
      });
      const data = (await res.json()) as { error?: string; email?: string };
      if (!res.ok) throw new Error(data.error || "Неверный код");
      setAccountEmail(data.email || email.trim().toLowerCase());
      setEmailMsg("Почта привязана");
      setCodeSent(false);
      setCode("");
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setEmailBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = {
      ...form,
      namePending: form.name.trim() ? false : Boolean(form.namePending),
    };
    setForm(next);
    setProfile(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  async function onPhoto(file: File | null) {
    if (!file) return;
    try {
      const photoData = await compressImageFile(file, 480, 0.72);
      setForm((f) => ({ ...f, photoData }));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="maya-page mx-auto w-full max-w-2xl px-4 py-8">
      {adding && (
        <OnboardingFlow mode="add" onClose={() => setAdding(false)} />
      )}

      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        профиль
      </p>
      <h1 className="font-display mt-1.5 text-3xl font-semibold">Малыши</h1>
      <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted">
        Можно вести нескольких детей. У каждого — свои дневники, гардероб и чат с
        Маей.
      </p>

      <a
        href="/register"
        className="mt-4 flex w-full items-center justify-center rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white"
      >
        Регистрация по почте →
      </a>

      <div className="mt-6 rounded-2xl border border-line bg-card/70 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Аккаунт · почта
        </p>
        {emailVerified && accountEmail ? (
          <p className="mt-2 text-sm text-foreground">
            Привязана: <span className="font-medium">{accountEmail}</span>
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted">
              Привяжите почту — для входа и подписки.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@mail.ru"
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
            />
            {codeSent && (
              <input
                inputMode="numeric"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Код из письма"
                className="w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm tracking-[0.15em]"
              />
            )}
            {emailError && (
              <p className="text-sm text-red-600 dark:text-red-300">{emailError}</p>
            )}
            {emailMsg && (
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {emailMsg}
              </p>
            )}
            {!codeSent ? (
              <button
                type="button"
                disabled={emailBusy}
                onClick={() => void sendCode()}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {emailBusy ? "Отправляю…" : "Получить код"}
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={emailBusy || code.length < 6}
                  onClick={() => void verifyCode()}
                  className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {emailBusy ? "Проверяю…" : "Подтвердить"}
                </button>
                <button
                  type="button"
                  disabled={emailBusy}
                  onClick={() => void sendCode()}
                  className="rounded-xl border border-line px-4 py-2.5 text-sm"
                >
                  Ещё раз
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {children.map((c) => {
          const active = c.id === activeChildId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => switchChild(c.id)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 transition ${
                active
                  ? "border-accent/40 bg-accent-soft"
                  : "border-line bg-card/60 hover:border-accent/25"
              }`}
            >
              <span className="flex h-9 w-9 overflow-hidden rounded-xl bg-background">
                {c.photoData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photoData} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="m-auto text-xs text-muted">
                    {childDisplayName(c).slice(0, 1)}
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold">{childDisplayName(c)}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex shrink-0 items-center gap-2 rounded-2xl border border-dashed border-accent/40 px-3 py-2 text-sm font-semibold text-accent"
        >
          + Ещё ребёнок
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-4 rounded-2xl border border-line bg-card/70 p-5 maya-panel"
      >
        <div className="flex items-center gap-4">
          <label className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-accent/40 bg-accent-soft/30">
            {form.photoData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.photoData} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-accent">фото</span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Сейчас редактируете</p>
            <p className="font-display text-xl font-semibold">
              {childDisplayName(form)}
            </p>
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-muted">Имя малыша</span>
          <input
            value={form.name}
            disabled={Boolean(form.namePending)}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
                namePending: false,
              })
            }
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 disabled:opacity-40"
            placeholder="Например: Соня"
          />
        </label>

        {/* Показываем только пока имени ещё нет */}
        {(form.namePending || !form.name.trim()) && (
          <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
            <span className="text-sm text-muted">Имя ещё не выбрали</span>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(form.namePending)}
              onClick={() =>
                setForm({
                  ...form,
                  namePending: !form.namePending,
                  name: !form.namePending ? "" : form.name,
                })
              }
              className={`relative h-7 w-12 rounded-full ${
                form.namePending ? "bg-accent" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
                  form.namePending ? "left-[1.35rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        )}

        <label className="block text-sm">
          <span className="text-muted">Дата рождения</span>
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Пол</span>
          <select
            value={form.sex}
            onChange={(e) =>
              setForm({ ...form, sex: e.target.value as ChildProfile["sex"] })
            }
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
          >
            <option value="unknown">Не указан</option>
            <option value="girl">Девочка</option>
            <option value="boy">Мальчик</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-muted">Рост при рождении, см</span>
            <input
              inputMode="decimal"
              value={form.birthHeightCm ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  birthHeightCm: e.target.value
                    ? Number(e.target.value.replace(",", "."))
                    : undefined,
                })
              }
              className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Вес при рождении, кг</span>
            <input
              inputMode="decimal"
              value={form.birthWeightKg ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  birthWeightKg: e.target.value
                    ? Number(e.target.value.replace(",", "."))
                    : undefined,
                })
              }
              className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-muted">Город</span>
          <input
            value={form.city ?? ""}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
            placeholder="Город"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Аллергии и особенности</span>
          <textarea
            value={form.allergies}
            onChange={(e) => setForm({ ...form, allergies: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
            placeholder="Например: аллергия на белок коровьего молока"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Заметки</span>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2"
            placeholder="Что ещё важно знать о ребёнке"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white"
          >
            Сохранить
          </button>
          {saved && (
            <span className="maya-msg-in text-sm text-accent">Сохранено</span>
          )}
          {children.length > 1 && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Удалить профиль «${childDisplayName(form)}» и все дневники этого ребёнка?`,
                  )
                ) {
                  removeChild(form.id);
                }
              }}
              className="ml-auto text-sm text-blush hover:underline"
            >
              Удалить ребёнка
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
