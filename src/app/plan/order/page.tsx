"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  ACCOMPANIMENT_RUB,
  PLAN_CONSULTANT_NAMES,
  PLAN_INCLUDES,
  PLAN_OFFER_TITLE,
  PLAN_TOPIC_LABEL_NOM,
  accompanimentPriceLine,
  planOfferHookForTopic,
  type PlanTopic,
} from "@/lib/plan-products";
import { PLAN_CONSULTANT_IDS } from "@/lib/plan-consultants";
import { PlanConsultantAvatar } from "@/components/plan/PlanConsultantAvatar";
import { clientEntriesForTopic } from "@/lib/backup-read-client";
import { readPlanOfferInstant } from "@/lib/plan-offer-instant";
import { useAppStore } from "@/lib/store";
import { LEGAL_OPERATOR } from "@/lib/legal";

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const topic: PlanTopic | null =
    params.get("topic") === "feed"
      ? "feed"
      : params.get("topic") === "sleep"
        ? "sleep"
        : null;

  const activeChildId = useAppStore((s) => s.activeChildId);
  const child = useAppStore((s) =>
    s.children.find((c) => c.id === s.activeChildId),
  );
  const journals = useAppStore((s) => s.journals);
  const emailVerified = useAppStore((s) => s.emailVerified);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payBypass, setPayBypass] = useState(true);

  useEffect(() => {
    void fetch("/api/payments/plan/config", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { bypass?: boolean }) => setPayBypass(Boolean(d.bypass)))
      .catch(() => setPayBypass(true));
  }, []);

  const entries = useMemo(() => {
    if (!topic) return [];
    return clientEntriesForTopic(journals, topic);
  }, [journals, topic]);

  if (!topic) {
    return (
      <div className="maya-page mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-muted">Укажите тему</p>
        <Link href="/modules" className="mt-4 inline-block text-accent">
          К дневникам
        </Link>
      </div>
    );
  }

  const title = PLAN_TOPIC_LABEL_NOM[topic];

  const pay = async () => {
    if (!emailVerified) {
      router.push("/register");
      return;
    }
    if (entries.length < 1) {
      setError(`Добавьте хотя бы одну запись в дневник «${title}».`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/plan/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "plan",
          topic,
          childId: activeChildId,
          childName: child?.name,
          entries: entries.slice(0, 120),
          instant: readPlanOfferInstant(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        url?: string;
        redirect?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Не удалось оформить заказ");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.redirect) {
        router.push(data.redirect);
      }
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="maya-page mx-auto w-full max-w-lg px-4 py-8">
      <Link
        href={`/m/${topic === "sleep" ? "sleep" : "breastfeeding"}`}
        className="text-sm text-accent"
      >
        ← Назад к дневнику
      </Link>

      <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight">
        {PLAN_OFFER_TITLE} · {title.toLowerCase()}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {planOfferHookForTopic(topic)}
      </p>

      <div className="mt-6 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent-soft/60 to-card p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          Живой человек, не ИИ
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex shrink-0 -space-x-2">
            {PLAN_CONSULTANT_IDS.map((id) => (
              <PlanConsultantAvatar
                key={id}
                consultantId={id}
                size={40}
                className="ring-2 ring-white"
              />
            ))}
          </span>
          <p className="text-sm font-medium leading-snug">
            {PLAN_CONSULTANT_NAMES}
            <span className="mt-0.5 block text-xs font-normal text-muted">
              Смотрят дневник и отвечают в чате
            </span>
          </p>
        </div>
        <p className="font-display mt-4 text-3xl font-semibold">
          {accompanimentPriceLine()}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Разовая оплата за месяц. План придёт в чат, потом человек на связи —
          ничего отдельно докупать не нужно.
        </p>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed">
          {PLAN_INCLUDES.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-accent">✓</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy || entries.length < 1}
        onClick={() => void pay()}
        className="mt-6 w-full rounded-2xl bg-accent py-3.5 text-base font-semibold text-[var(--on-accent,#fff)] disabled:opacity-50"
      >
        {busy
          ? payBypass
            ? "Открываем чат…"
            : "Переход к оплате…"
          : payBypass
            ? "Оставить заявку живому консультанту"
            : `Оплатить ${ACCOMPANIMENT_RUB} ₽ · живой консультант`}
      </button>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
        Если за неделю поймёте, что это не ваш формат — напишите, остановим.
        Это не медицина.{" "}
        {!payBypass ? (
          <>
            Нажимая «Оплатить», вы соглашаетесь с{" "}
            <Link href="/legal/offer" className="text-accent underline">
              офертой
            </Link>
            .{" "}
          </>
        ) : null}
        Поддержка:{" "}
        <a href={`mailto:${LEGAL_OPERATOR.supportEmail}`} className="text-accent">
          {LEGAL_OPERATOR.supportEmail}
        </a>
      </p>
    </div>
  );
}

export default function PlanCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-muted">
          Загрузка…
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
