"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  ACCOMPANIMENT_INCLUDES,
  ACCOMPANIMENT_RUB,
  PLAN_BREAKDOWN_RUB,
  PLAN_INCLUDES,
  PLAN_TOPIC_LABEL,
  PLAN_TOPIC_LABEL_NOM,
  type PlanTopic,
} from "@/lib/plan-products";
import { clientEntriesForTopic } from "@/lib/backup-read-client";
import { useAppStore } from "@/lib/store";
import { LEGAL_OPERATOR } from "@/lib/legal";

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const topic = params.get("topic") === "feed" ? "feed" : params.get("topic") === "sleep" ? "sleep" : null;

  const activeChildId = useAppStore((s) => s.activeChildId);
  const child = useAppStore((s) =>
    s.children.find((c) => c.id === s.activeChildId),
  );
  const journals = useAppStore((s) => s.journals);
  const emailVerified = useAppStore((s) => s.emailVerified);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = useMemo(() => {
    if (!topic) return [];
    return clientEntriesForTopic(journals, topic);
  }, [journals, topic]);

  if (!topic) {
    return (
      <div className="maya-page mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-muted">Укажите тему разбора</p>
        <Link href="/modules" className="mt-4 inline-block text-accent">
          К дневникам
        </Link>
      </div>
    );
  }

  const label = PLAN_TOPIC_LABEL[topic];
  const title = PLAN_TOPIC_LABEL_NOM[topic];

  const pay = async () => {
    if (!emailVerified) {
      router.push("/register");
      return;
    }
    if (entries.length < 2) {
      setError(`Добавьте ещё записи в дневник «${title}» — нужно минимум 2.`);
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
      <Link href={`/m/${topic === "sleep" ? "sleep" : "breastfeeding"}`} className="text-sm text-accent">
        ← Назад к дневнику
      </Link>

      <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight">
        План + разбор · {title.toLowerCase()}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Персонально по вашему дневнику. Специалист свяжется в чате, план придёт в PDF.
      </p>

      <div className="mt-6 rounded-2xl border border-line bg-card/80 p-5">
        <p className="font-display text-3xl font-semibold">
          {PLAN_BREAKDOWN_RUB} ₽
        </p>
        <p className="mt-1 text-xs text-muted">разовая оплата</p>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed">
          {PLAN_INCLUDES.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-accent">✓</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Записей в дневнике: {entries.length}
          {child?.name ? ` · ${child.name}` : ""}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-line bg-accent-soft/30 p-4 text-xs leading-relaxed text-muted">
        <p className="font-semibold text-foreground">Сопровождение неделю</p>
        <p className="mt-1">
          После разбора можно подключить за {ACCOMPANIMENT_RUB} ₽:{" "}
          {ACCOMPANIMENT_INCLUDES[0].toLowerCase()}.
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy || entries.length < 2}
        onClick={() => void pay()}
        className="mt-6 w-full rounded-2xl bg-accent py-3.5 text-base font-semibold text-[var(--on-accent,#fff)] disabled:opacity-50"
      >
        {busy ? "Переход к оплате…" : `Оплатить ${PLAN_BREAKDOWN_RUB} ₽`}
      </button>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
        Нажимая «Оплатить», вы соглашаетесь с{" "}
        <Link href="/legal/offer" className="text-accent underline">
          офертой
        </Link>
        . Поддержка:{" "}
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
