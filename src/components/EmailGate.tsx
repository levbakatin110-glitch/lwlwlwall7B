"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";

/** Если анкету уже прошли раньше — всё равно просим почту */
export function EmailGate({ children }: { children: React.ReactNode }) {
  const emailVerified = useAppStore((s) => s.emailVerified);
  const accountEmail = useAppStore((s) => s.accountEmail);
  const setAccountEmail = useAppStore((s) => s.setAccountEmail);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (emailVerified && accountEmail) {
    return <>{children}</>;
  }

  async function sendCode() {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Укажите нормальную почту");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
        }),
      });
      const data = (await res.json()) as { error?: string; email?: string };
      if (!res.ok) throw new Error(data.error || "Неверный код");
      setAccountEmail(data.email || email.trim().toLowerCase());
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
          Регистрация
        </p>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">
          Ваша почта
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Подтвердите email — без этого дальше нельзя. Пришлём код на почту.
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

          {!codeSent ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendCode()}
              className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Отправляю…" : "Получить код"}
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                disabled={busy || code.length < 6}
                onClick={() => void verify()}
                className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Проверяю…" : "Подтвердить и войти"}
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
        </div>
      </div>
    </div>
  );
}
