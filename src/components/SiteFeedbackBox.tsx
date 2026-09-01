"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";

export function SiteFeedbackBox() {
  const accountEmail = useAppStore((s) => s.accountEmail);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const text = message.trim();
    if (text.length < 4) {
      setError("Напишите хотя бы пару слов");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          page:
            typeof window !== "undefined"
              ? window.location.pathname + window.location.search
              : "/",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось отправить");
      setMessage("");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <section
        className="rounded-[1.5rem] border border-emerald-500/25 bg-gradient-to-br from-emerald-50/80 via-card/90 to-teal-50/40 px-4 py-5 dark:border-emerald-400/20 dark:from-emerald-950/30 dark:via-card dark:to-teal-950/20"
        aria-label="Отзыв отправлен"
      >
        <p className="font-display text-lg font-semibold tracking-tight text-foreground">
          Запрос отправлен разработчику
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Спасибо — мы читаем каждое сообщение и постараемся учесть.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-sm font-medium text-accent underline decoration-accent/30 underline-offset-2"
        >
          Написать ещё
        </button>
      </section>
    );
  }

  return (
    <section
      className="rounded-[1.5rem] border border-line/80 bg-card/80 px-4 py-5 shadow-sm"
      aria-label="Предложить улучшение"
    >
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          Обратная связь
        </p>
        <h2 className="font-display mt-1 text-xl font-semibold tracking-tight text-foreground">
          Что улучшить на сайте?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Напишите прямо здесь — не на почту. Не нравится кнопка, тормозит, непонятно
          где что — всё подойдёт.
        </p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <label className="block">
          <span className="sr-only">Ваш отзыв</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Например: не нравится, что… / не хватает… / можно сделать проще…"
            className="w-full resize-none rounded-2xl border border-line bg-background/80 px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition focus:border-accent/45"
          />
        </label>

        {accountEmail ? (
          <p className="text-xs text-muted">
            Ответ придёт на почту аккаунта, если понадобится:{" "}
            <span className="font-medium text-foreground">{accountEmail}</span>
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-[color-mix(in_oklab,var(--blush)_80%,#900)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || message.trim().length < 4}
          className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] transition enabled:hover:bg-accent-hot disabled:opacity-45"
        >
          {busy ? "Отправляю…" : "Отправить разработчику"}
        </button>
      </form>
    </section>
  );
}
