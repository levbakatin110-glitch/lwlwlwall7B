"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACCOMPANIMENT_RUB,
  PLAN_BREAKDOWN_RUB,
  PLAN_TOPIC_LABEL,
  SPECIALIST_DISPLAY_NAME,
  type PlanTopic,
} from "@/lib/plan-products";
import { useAppStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

type OrderMessage = {
  id: string;
  createdAt: string;
  role: "user" | "specialist" | "system";
  text?: string;
  pdfUrl?: string;
};

type PlanOrder = {
  id: string;
  status: string;
  topic: PlanTopic;
  chatClosedAt?: string;
  messages: OrderMessage[];
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SpecialistChat({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<PlanOrder | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/plan-orders/${orderId}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { order: PlanOrder };
      setOrder(data.order);
    } catch {
      /* ignore */
    }
  }, [orderId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [order?.messages.length]);

  const send = async () => {
    const msg = text.trim();
    if (!msg || sending || order?.chatClosedAt) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/plan-orders/${orderId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg }),
      });
      const data = (await res.json()) as { error?: string; order?: PlanOrder };
      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить");
        return;
      }
      setText("");
      if (data.order) setOrder(data.order);
      else void load();
    } catch {
      setError("Нет связи");
    } finally {
      setSending(false);
    }
  };

  const closed = Boolean(order?.chatClosedAt);
  const topic = order ? PLAN_TOPIC_LABEL[order.topic] : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-line bg-card/80 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          Разбор · {topic}
        </p>
        <h1 className="font-display text-lg font-semibold">
          {SPECIALIST_DISPLAY_NAME}
        </h1>
        <p className="mt-1 text-xs text-muted">
          Персональный план + разбор · {PLAN_BREAKDOWN_RUB} ₽
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4">
        {order?.messages.map((m) => {
          const mine = m.role === "user";
          const system = m.role === "system";
          if (system) {
            return (
              <p
                key={m.id}
                className="mx-auto max-w-sm rounded-2xl bg-accent-soft/80 px-4 py-3 text-center text-xs leading-relaxed text-foreground"
              >
                {m.text}
              </p>
            );
          }
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  mine
                    ? "bg-accent text-[var(--on-accent,#fff)]"
                    : "border border-line bg-card"
                }`}
              >
                {!mine && (
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {SPECIALIST_DISPLAY_NAME}
                  </p>
                )}
                {m.text ? <p className="whitespace-pre-wrap">{m.text}</p> : null}
                {m.pdfUrl ? (
                  <a
                    href={m.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                      mine
                        ? "bg-white/20"
                        : "bg-accent-soft text-foreground"
                    }`}
                  >
                    📄 Персональный план (PDF)
                  </a>
                ) : null}
                <p
                  className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-muted"}`}
                >
                  {fmtTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {closed ? (
        <div className="shrink-0 border-t border-line bg-card/90 p-4">
          <p className="text-center text-sm text-muted">
            Разбор завершён. План остаётся у вас.
          </p>
          <p className="mt-3 text-center text-sm">
            <span className="text-muted">Нужна поддержка всю неделю? </span>
            <span className="font-semibold">
              Сопровождение · +{ACCOMPANIMENT_RUB} ₽
            </span>
            <span className="mt-1 block text-xs text-muted">
              (оплата подключим вместе с кассой)
            </span>
          </p>
          <Link
            href="/"
            className="mt-4 block text-center text-sm font-medium text-accent"
          >
            На главную
          </Link>
        </div>
      ) : (
        <div className="shrink-0 border-t border-line bg-card/90 p-3">
          {error ? (
            <p className="mb-2 text-center text-xs text-red-600">{error}</p>
          ) : null}
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="Ваш ответ специалисту…"
              className="min-h-[44px] flex-1 resize-none rounded-2xl border border-line bg-background px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !text.trim()}
              className="shrink-0 rounded-2xl bg-accent px-4 text-sm font-semibold text-[var(--on-accent,#fff)] disabled:opacity-50"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PlanOfferBanner({ moduleId }: { moduleId: string }) {
  const topic: PlanTopic | null =
    moduleId === "sleep" ? "sleep" : moduleId === "breastfeeding" ? "feed" : null;
  const activeChildId = useAppStore((s) => s.activeChildId);
  const child = useAppStore((s) =>
    s.children.find((c) => c.id === s.activeChildId),
  );
  const journals = useAppStore((s) => s.journals);
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!topic) return;
    void fetch("/api/plan-orders", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { orders?: { id: string; topic: string; chatClosedAt?: string }[] }) => {
        const hit = d.orders?.find(
          (o) => o.topic === topic && !o.chatClosedAt,
        );
        setActiveId(hit?.id ?? null);
      })
      .catch(() => {});
  }, [topic]);

  if (!topic) return null;

  const entries = (journals[moduleId] ?? []) as JournalEntry[];
  const entryCount = entries.length;
  const label = PLAN_TOPIC_LABEL[topic];

  const start = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/plan-orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          childId: activeChildId,
          childName: child?.name,
          entries: entries.slice(0, 80),
        }),
      });
      const data = (await res.json()) as { order?: { id: string }; error?: string };
      if (data.order?.id) {
        window.location.href = `/plan/${data.order.id}`;
      }
    } finally {
      setBusy(false);
    }
  };

  if (activeId) {
    return (
      <div className="mb-4 rounded-2xl border border-accent/30 bg-accent-soft/50 p-4">
        <p className="text-sm font-semibold">Ваш разбор · {label}</p>
        <p className="mt-1 text-xs text-muted">
          Специалист готовит план по дневнику
        </p>
        <Link
          href={`/plan/${activeId}`}
          className="mt-3 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[var(--on-accent,#fff)]"
        >
          Открыть чат
        </Link>
      </div>
    );
  }

  if (entryCount < 2) {
    return (
      <div className="mb-4 rounded-2xl border border-line bg-card/60 p-4">
        <p className="text-sm text-muted">
          Ведите дневник {label} ещё день-два — и можно заказать персональный
          план + разбор ({PLAN_BREAKDOWN_RUB} ₽).
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-accent/25 bg-gradient-to-br from-accent-soft/80 to-card p-4">
      <p className="font-display text-base font-semibold">
        Персональный план + разбор
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Специалист разберёт ваш дневник ({label}) и составит план. Ожидание — до
        24 часов. · {PLAN_BREAKDOWN_RUB} ₽
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void start()}
        className="mt-3 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[var(--on-accent,#fff)] disabled:opacity-60"
      >
        {busy ? "Создаём…" : "Заказать разбор"}
      </button>
      <p className="mt-2 text-[10px] text-muted">
        Оплата подключится с кассой — сейчас тестовый доступ
      </p>
    </div>
  );
}
