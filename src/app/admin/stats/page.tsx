"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AnalyticsSummary } from "@/lib/analytics-store";

const PASS_KEY = "maya-analytics-pass";

const LABELS: Record<string, string> = {
  visit: "Визиты",
  register: "Регистрации",
  login: "Входы",
  onboarding_done: "Анкеты",
  chat_send: "Сообщения в чат",
  pricing_view: "Смотрели цены",
  subscribe_click: "Клик «оплатить»",
  subscribe_activate: "Активации подписки",
};

export default function AnalyticsPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/summary?days=14", {
        headers: { "x-analytics-password": pass },
      });
      if (res.status === 401) {
        setAuthed(false);
        setError("Неверный пароль");
        sessionStorage.removeItem(PASS_KEY);
        return;
      }
      if (!res.ok) throw new Error("Не удалось загрузить");
      const json = (await res.json()) as AnalyticsSummary;
      setData(json);
      setAuthed(true);
      sessionStorage.setItem(PASS_KEY, pass);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(PASS_KEY);
    if (saved) {
      setPassword(saved);
      void load(saved);
    }
  }, [load]);

  async function clearAll() {
    const pass = sessionStorage.getItem(PASS_KEY) || password;
    if (!pass || !confirm("Очистить всю аналитику?")) return;
    await fetch("/api/analytics/summary", {
      method: "DELETE",
      headers: { "x-analytics-password": pass },
    });
    void load(pass);
  }

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
        <h1 className="font-display text-2xl font-semibold">Аналитика</h1>
        <p className="mt-2 text-sm text-muted">
          Только для тебя. Пароль из{" "}
          <code className="text-foreground">ANALYTICS_PASSWORD</code> на
          сервере (по умолчанию{" "}
          <code className="text-foreground">maya-stats</code>).
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void load(password);
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm"
            autoFocus
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-[#fff] disabled:opacity-50"
          >
            {loading ? "…" : "Войти"}
          </button>
        </form>
        <Link href="/" className="mt-6 text-center text-xs text-muted underline">
          На сайт
        </Link>
      </div>
    );
  }

  const t = data?.totals;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Только владелец
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold">Аналитика</h1>
          <p className="mt-1 text-sm text-muted">Последние 14 дней · /admin/stats</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load(sessionStorage.getItem(PASS_KEY) || password)}
            className="rounded-xl border border-line px-3 py-1.5 text-xs"
          >
            Обновить
          </button>
          <button
            type="button"
            onClick={() => void clearAll()}
            className="rounded-xl border border-line px-3 py-1.5 text-xs text-muted"
          >
            Очистить
          </button>
          <Link
            href="/admin"
            className="rounded-xl border border-line px-3 py-1.5 text-xs text-muted"
          >
            Админка
          </Link>
        </div>
      </div>

      {t && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              "visit",
              "uniqueVisitors",
              "register",
              "login",
              "onboarding_done",
              "chat_send",
              "pricing_view",
              "subscribe_click",
              "subscribe_activate",
            ] as const
          ).map((key) => (
            <div
              key={key}
              className="rounded-2xl border border-line bg-card/80 p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {key === "uniqueVisitors"
                  ? "Уники"
                  : LABELS[key] || key}
              </p>
              <p className="font-display mt-1 text-2xl font-semibold">
                {key === "uniqueVisitors"
                  ? t.uniqueVisitors
                  : t[key as keyof typeof t]}
              </p>
            </div>
          ))}
        </div>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">По дням</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-card/80 text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">День</th>
                <th className="px-2 py-2 font-medium">Визиты</th>
                <th className="px-2 py-2 font-medium">Уники</th>
                <th className="px-2 py-2 font-medium">Рег</th>
                <th className="px-2 py-2 font-medium">Анкета</th>
                <th className="px-2 py-2 font-medium">Чат</th>
                <th className="px-2 py-2 font-medium">Цены</th>
                <th className="px-2 py-2 font-medium">Клик</th>
                <th className="px-2 py-2 font-medium">Оплата*</th>
              </tr>
            </thead>
            <tbody>
              {(data?.byDay ?? []).map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <td className="px-3 py-2 font-medium">{d.day}</td>
                  <td className="px-2 py-2">{d.visit}</td>
                  <td className="px-2 py-2">{d.uniqueVisitors}</td>
                  <td className="px-2 py-2">{d.register}</td>
                  <td className="px-2 py-2">{d.onboarding_done}</td>
                  <td className="px-2 py-2">{d.chat_send}</td>
                  <td className="px-2 py-2">{d.pricing_view}</td>
                  <td className="px-2 py-2">{d.subscribe_click}</td>
                  <td className="px-2 py-2">{d.subscribe_activate}</td>
                </tr>
              ))}
              {!data?.byDay.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-muted">
                    Пока пусто — появятся после трафика.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          * Пока оплата локальная (кнопка на сайте). Когда подключим ЮKassa —
          сюда же лягут реальные платежи.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Последние события</h2>
        <ul className="mt-3 max-h-80 space-y-1.5 overflow-y-auto text-xs">
          {(data?.recent ?? []).map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap gap-x-2 rounded-lg border border-line/70 px-2.5 py-1.5"
            >
              <span className="font-semibold text-accent">
                {LABELS[e.name] || e.name}
              </span>
              <span className="text-muted">
                {new Date(e.at).toLocaleString("ru-RU")}
              </span>
              {e.meta && <span className="text-muted">· {e.meta}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
