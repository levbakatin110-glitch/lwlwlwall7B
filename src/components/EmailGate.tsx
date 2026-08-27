"use client";

import Link from "next/link";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics-client";
import { OAuthButtons } from "@/components/OAuthButtons";
import { useAppStore } from "@/lib/store";

type AuthMode = "register" | "login" | "recover";

/** Если анкету уже прошли раньше — всё равно просим почту */
export function EmailGate({ children }: { children: React.ReactNode }) {
  const emailVerified = useAppStore((s) => s.emailVerified);
  const accountEmail = useAppStore((s) => s.accountEmail);
  const setAccountEmail = useAppStore((s) => s.setAccountEmail);

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentOffer, setConsentOffer] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);

  if (emailVerified && accountEmail) {
    return <>{children}</>;
  }

  const needConsents = authMode === "register";
  const consentsOk = !needConsents || (consentOffer && consentPrivacy);

  function switchMode(next: AuthMode) {
    setAuthMode(next);
    setCodeSent(false);
    setCode("");
    setError(null);
  }

  async function sendCode() {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Укажите нормальную почту");
      return;
    }
    if (!consentsOk) {
      setError("Отметьте обязательные согласия под формой");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось отправить");
      setCodeSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
        }),
      });
      const data = (await res.json()) as { error?: string; email?: string };
      if (!res.ok) throw new Error(data.error || "Неверный код");
      setAccountEmail(data.email || email.trim().toLowerCase());
      trackEvent(authMode === "register" ? "register" : "login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background px-5 text-foreground">
      <div className="w-full max-w-md">
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
            ? "Только российская почта (Mail.ru, Яндекс, .ru). Пришлём код. Или войдите через Mail.ru."
            : authMode === "login"
              ? "Вход по коду на почту (РФ) или через Mail.ru — пароль не нужен."
              : "Введите российскую почту аккаунта — пришлём новый код."}
        </p>

        <div className="mt-6 space-y-3">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@mail.ru"
            className="w-full rounded-xl border border-line bg-card px-3 py-3.5 text-sm outline-none focus:border-accent/50"
          />
          {codeSent && (
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="Код из письма (6 цифр)"
              className="w-full rounded-xl border border-line bg-card px-3 py-3.5 text-sm tracking-[0.2em] outline-none focus:border-accent/50"
            />
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

          {!codeSent && needConsents && (
            <div className="space-y-2.5 rounded-xl border border-line bg-card/50 px-3 py-3 text-[11px] leading-snug text-muted">
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={consentOffer}
                  onChange={(e) => setConsentOffer(e.target.checked)}
                />
                <span>
                  Принимаю{" "}
                  <Link
                    href="/legal/offer"
                    target="_blank"
                    className="text-accent underline"
                  >
                    публичную оферту
                  </Link>
                </span>
              </label>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={consentPrivacy}
                  onChange={(e) => setConsentPrivacy(e.target.checked)}
                />
                <span>
                  Соглашаюсь с{" "}
                  <Link
                    href="/legal/privacy"
                    target="_blank"
                    className="text-accent underline"
                  >
                    политикой персональных данных
                  </Link>{" "}
                  и обработкой моих данных
                </span>
              </label>
            </div>
          )}

          {!codeSent ? (
            <button
              type="button"
              disabled={busy || !consentsOk}
              onClick={() => void sendCode()}
              className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy
                ? "Отправляю…"
                : authMode === "register"
                  ? "Получить код"
                  : "Получить код для входа"}
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                disabled={busy || code.length < 6}
                onClick={() => void verify()}
                className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy
                  ? "Проверяю…"
                  : authMode === "register"
                    ? "Подтвердить и войти"
                    : "Войти"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendCode()}
                className="w-full text-sm text-muted underline"
              >
                Отправить код ещё раз
              </button>
            </div>
          )}

          {!codeSent && authMode !== "recover" && (
            <OAuthButtons
              mode={authMode === "register" ? "register" : "login"}
              consentsOk={consentsOk}
              returnTo="/register"
              onError={(msg) => setError(msg || null)}
            />
          )}

          <div className="flex flex-col gap-2 pt-1 text-center text-sm">
            {authMode === "register" ? (
              <>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-accent underline underline-offset-2"
                >
                  Уже есть аккаунт? Войти
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("recover")}
                  className="text-muted underline underline-offset-2"
                >
                  Забыли пароль?
                </button>
              </>
            ) : authMode === "login" ? (
              <>
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="text-accent underline underline-offset-2"
                >
                  Нет аккаунта? Зарегистрироваться
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("recover")}
                  className="text-muted underline underline-offset-2"
                >
                  Забыли пароль?
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-accent underline underline-offset-2"
              >
                ← Назад ко входу
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
