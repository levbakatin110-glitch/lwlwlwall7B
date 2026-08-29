"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { clientEntriesForTopic } from "@/lib/backup-read-client";
import {
  evaluatePlanOfferEligibility,
  evaluatePlanSelfServeEligibility,
} from "@/lib/plan-offer-eligibility";
import {
  enablePlanOfferInstantFromUrl,
  readPlanOfferInstant,
} from "@/lib/plan-offer-instant";
import { useAppStore } from "@/lib/store";
import { orderStatusHint } from "@/lib/plan-consultants";
import {
  ACCOMPANIMENT_INCLUDES,
  ACCOMPANIMENT_RUB,
  PLAN_BREAKDOWN_RUB,
  PLAN_OFFER_HOOK,
  PLAN_OFFER_TITLE,
  PLAN_TOPIC_LABEL,
  PLAN_TOPIC_LABEL_NOM,
  type PlanTopic,
} from "@/lib/plan-products";
import { PlanConsultantAvatar } from "@/components/plan/PlanConsultantAvatar";

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
  accompanimentPaid?: boolean;
  accompanimentPending?: boolean;
  messages: OrderMessage[];
  consultant?: {
    id: string;
    name: string;
    avatar: string;
    role: string;
  };
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
  const router = useRouter();
  const [order, setOrder] = useState<PlanOrder | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/plan-orders/${orderId}`, {
        credentials: "include",
      });
      if (res.status === 404) {
        router.replace("/");
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { order: PlanOrder };
      setOrder(data.order);
    } catch {
      /* ignore */
    }
  }, [orderId, router]);

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

  const buyAccompaniment = async () => {
    setPayBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/plan/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "accompany", parentOrderId: orderId }),
      });
      const data = (await res.json()) as {
        error?: string;
        url?: string;
        redirect?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Не удалось оформить");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.redirect) router.push(data.redirect);
      else void load();
    } catch {
      setError("Нет связи");
    } finally {
      setPayBusy(false);
    }
  };

  const closed = Boolean(order?.chatClosedAt) && !order?.accompanimentPaid;
  const topic = order ? PLAN_TOPIC_LABEL[order.topic] : "";
  const consultant = order?.consultant;
  const statusHint =
    order && consultant
      ? orderStatusHint(order.status, consultant.name)
      : null;

  if (order?.status === "awaiting_payment") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-lg font-semibold">Ожидаем оплату…</p>
        <p className="mt-2 text-sm text-muted">
          Если вы уже оплатили — подождите несколько секунд.
        </p>
        <Link
          href={`/plan/order/success?order=${orderId}`}
          className="mt-4 text-sm font-medium text-accent"
        >
          Обновить статус
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-line bg-card/80 px-4 py-3">
        <div className="flex items-center gap-3">
          {consultant ? (
            <PlanConsultantAvatar
              consultantId={consultant.id}
              name={consultant.name}
              avatar={consultant.avatar}
              size={48}
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Разбор · {topic}
            </p>
            <h1 className="font-display text-lg font-semibold">
              {consultant?.name ?? "Консультант"}
            </h1>
            <p className="text-[11px] text-muted">
              {consultant?.role ?? "Консультант по режиму"} · не врач
            </p>
          </div>
        </div>
        {statusHint ? (
          <p className="mt-2 text-xs text-accent">{statusHint}</p>
        ) : null}
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
              className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
            >
              {!mine && consultant ? (
                <PlanConsultantAvatar
                  consultantId={consultant.id}
                  name={consultant.name}
                  avatar={consultant.avatar}
                  size={32}
                  className="mb-1"
                />
              ) : null}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  mine
                    ? "bg-accent text-[var(--on-accent,#fff)]"
                    : "border border-line bg-card"
                }`}
              >
                {!mine && consultant ? (
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {consultant.name}
                  </p>
                ) : null}
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
                    Персональный план (PDF)
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
            Разбор завершён. План остаётся у вас в переписке.
          </p>
          <div className="mt-4 rounded-2xl border border-accent/25 bg-accent-soft/40 p-4">
            <p className="font-display text-base font-semibold">
              Сопровождение неделю · {ACCOMPANIMENT_RUB} ₽
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {ACCOMPANIMENT_INCLUDES.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled={payBusy || order?.accompanimentPending}
              onClick={() => void buyAccompaniment()}
              className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-[var(--on-accent,#fff)] disabled:opacity-60"
            >
              {order?.accompanimentPending
                ? "Ожидаем оплату…"
                : payBusy
                  ? "Переход к оплате…"
                  : "Хочу, чтобы вели неделю"}
            </button>
          </div>
          <Link
            href="/modules"
            className="mt-4 block text-center text-sm font-medium text-accent"
          >
            К дневникам
          </Link>
        </div>
      ) : order?.accompanimentPaid ? (
        <div className="shrink-0 border-t border-line bg-card/90 p-3">
          {error ? (
            <p className="mb-2 text-center text-xs text-red-600">{error}</p>
          ) : null}
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder={consultant ? `Сообщение ${consultant.name}…` : "Сообщение…"}
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
              placeholder={consultant ? `Ваш вопрос ${consultant.name}…` : "Ваш вопрос…"}
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
    moduleId === "sleep"
      ? "sleep"
      : moduleId === "breastfeeding" ||
          moduleId === "formula" ||
          moduleId === "solids"
        ? "feed"
        : null;

  const journals = useAppStore((s) => s.journals);
  const birthDate = useAppStore((s) => s.profile?.birthDate);
  const [instant, setInstant] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [closedId, setClosedId] = useState<string | null>(null);

  useEffect(() => {
    setInstant(enablePlanOfferInstantFromUrl() || readPlanOfferInstant());
  }, []);

  useEffect(() => {
    if (!topic) return;
    void fetch("/api/plan-orders", { credentials: "include" })
      .then((r) => r.json())
      .then(
        (d: {
          orders?: {
            id: string;
            topic: string;
            chatClosedAt?: string;
            accompanimentPaid?: boolean;
            status: string;
          }[];
        }) => {
          const mine = (d.orders ?? []).filter((o) => o.topic === topic);
          const open = mine.find(
            (o) => !o.chatClosedAt || o.status === "accompaniment_active",
          );
          const closed = mine.find((o) => o.chatClosedAt && !o.accompanimentPaid);
          setActiveId(open?.id ?? null);
          setClosedId(closed?.id ?? null);
        },
      )
      .catch(() => {});
  }, [topic]);

  if (!topic) return null;

  const entries = clientEntriesForTopic(journals, topic);
  const eligibility = evaluatePlanOfferEligibility({
    topic,
    entries,
    journals,
    birthDate,
    instant,
  });
  const label = PLAN_TOPIC_LABEL[topic];

  if (activeId) {
    return (
      <div className="mb-4 rounded-2xl border border-accent/30 bg-accent-soft/50 p-4">
        <p className="text-sm font-semibold">Ваш разбор · {label}</p>
        <Link
          href={`/plan/${activeId}`}
          className="mt-3 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[var(--on-accent,#fff)]"
        >
          Открыть чат
        </Link>
      </div>
    );
  }

  if (closedId) {
    return (
      <div className="mb-4 rounded-2xl border border-line bg-card/70 p-4">
        <p className="text-sm font-semibold">Разбор завершён</p>
        <Link
          href={`/plan/${closedId}`}
          className="mt-3 inline-flex rounded-xl border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-accent"
        >
          Открыть чат
        </Link>
      </div>
    );
  }

  if (!eligibility.showOffer) {
    return null;
  }

  return (
    <div className="mb-4 rounded-2xl border border-accent/25 bg-gradient-to-br from-accent-soft/80 to-card p-4">
      <p className="font-display text-base font-semibold">{PLAN_OFFER_TITLE}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{PLAN_OFFER_HOOK}</p>
      <Link
        href={`/plan/order?topic=${topic}`}
        className="mt-3 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[var(--on-accent,#fff)]"
      >
        Разобрать дневник · {PLAN_BREAKDOWN_RUB} ₽
      </Link>
    </div>
  );
}

function topicFromModuleId(moduleId: string): PlanTopic | null {
  if (moduleId === "sleep") return "sleep";
  if (
    moduleId === "breastfeeding" ||
    moduleId === "formula" ||
    moduleId === "solids"
  ) {
    return "feed";
  }
  return null;
}

/** Тихая ссылка внизу дневника — для тех, кто хочет план сам */
export function PlanSelfServeHint({ moduleId }: { moduleId: string }) {
  const topic = topicFromModuleId(moduleId);
  const journals = useAppStore((s) => s.journals);
  const birthDate = useAppStore((s) => s.profile?.birthDate);
  const [instant, setInstant] = useState(false);
  const [hasOrder, setHasOrder] = useState(false);

  useEffect(() => {
    setInstant(enablePlanOfferInstantFromUrl() || readPlanOfferInstant());
  }, []);

  useEffect(() => {
    if (!topic) return;
    void fetch("/api/plan-orders", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { orders?: { topic: string }[] } | null) => {
        const mine = (d?.orders ?? []).filter((o) => o.topic === topic);
        setHasOrder(mine.length > 0);
      })
      .catch(() => {});
  }, [topic]);

  if (!topic || hasOrder) return null;

  const entries = clientEntriesForTopic(journals, topic);
  const concern = evaluatePlanOfferEligibility({
    topic,
    entries,
    journals,
    birthDate,
    instant,
  });
  const selfServe = evaluatePlanSelfServeEligibility({ entries });

  if (concern.showOffer || !selfServe.canOrder) return null;

  const label = PLAN_TOPIC_LABEL[topic];

  return (
    <p className="mt-5 text-center text-[11px] leading-relaxed text-muted">
      Хотите разбор по {label}, даже если всё спокойно?{" "}
      <Link
        href={`/plan/order?topic=${topic}&self=1`}
        className="font-medium text-accent underline decoration-accent/30 underline-offset-2"
      >
        Заказать · {PLAN_BREAKDOWN_RUB} ₽
      </Link>
    </p>
  );
}

/** Профиль — ненавязчивые ссылки на заказ разбора */
export function PlanServicesCard() {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-card/50 px-4 py-3.5">
      <p className="text-sm font-medium text-foreground">
        Персональный план по дневнику
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Разбор сна или кормления с консультантом · {PLAN_BREAKDOWN_RUB} ₽ · не
        врач
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Link
          href="/plan/order?topic=sleep&self=1"
          className="rounded-full border border-line bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-accent/30"
        >
          {PLAN_TOPIC_LABEL_NOM.sleep}
        </Link>
        <Link
          href="/plan/order?topic=feed&self=1"
          className="rounded-full border border-line bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-accent/30"
        >
          {PLAN_TOPIC_LABEL_NOM.feed}
        </Link>
      </div>
    </div>
  );
}
