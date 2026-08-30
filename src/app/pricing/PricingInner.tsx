"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconBadge } from "@/components/icons/MayaIcon";
import {
  BASE_MONTH_RUB,
  formatExpiry,
  formatRub,
  isSubscriptionActive,
  PAID_PLANS,
  planById,
  type PaidPlanId,
} from "@/lib/subscription";
import { CHAT_TOPUP_RUB } from "@/lib/chat-quota";
import { trackEvent } from "@/lib/analytics-client";
import { getValuePitch } from "@/lib/value-pitch";
import { useAppStore } from "@/lib/store";

export default function PricingInner() {
  const search = useSearchParams();
  const subscription = useAppStore((s) => s.subscription);
  const accountEmail = useAppStore((s) => s.accountEmail);
  const emailVerified = useAppStore((s) => s.emailVerified);
  const activateSubscription = useAppStore((s) => s.activateSubscription);
  const clearSubscription = useAppStore((s) => s.clearSubscription);
  const pregnancy = useAppStore((s) => s.pregnancy);
  const children = useAppStore((s) => s.children);
  const enabledModules = useAppStore((s) => s.enabledModules);
  const active = isSubscriptionActive(subscription);
  const current = active ? planById(subscription.planId) : null;
  const [busy, setBusy] = useState<PaidPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidHint, setPaidHint] = useState(false);

  const pitch = useMemo(
    () =>
      getValuePitch({
        pregnant: Boolean(pregnancy?.active),
        hasChild: children.some((c) => !c.namePending && Boolean(c.birthDate)),
        trackCycle: enabledModules.includes("cycle"),
      }),
    [pregnancy?.active, children, enabledModules],
  );

  useEffect(() => {
    trackEvent("pricing_view");
  }, []);

  useEffect(() => {
    if (search.get("paid") !== "1") return;
    setPaidHint(true);
    if (!accountEmail) return;
    void fetch(
      `/api/subscription/status?email=${encodeURIComponent(accountEmail)}`,
    )
      .then((r) => r.json())
      .then(
        (data: {
          active?: boolean;
          planId?: string;
          expiresAt?: string | null;
        }) => {
          if (data.active && data.planId && data.planId !== "free") {
            activateSubscription(data.planId as PaidPlanId);
            if (data.expiresAt) {
              useAppStore.setState({
                subscription: {
                  planId: data.planId as PaidPlanId,
                  expiresAt: data.expiresAt,
                },
              });
            }
          }
        },
      )
      .catch(() => {});
  }, [search, accountEmail, activateSubscription]);

  async function pick(id: PaidPlanId) {
    setError(null);
    trackEvent("subscribe_click", id);

    if (!emailVerified || !accountEmail) {
      setError("Сначала войдите по почте — Premium привязывается к email.");
      return;
    }

    setBusy(id);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: id, email: accountEmail }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Не удалось создать оплату");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка оплаты");
      setBusy(null);
    }
  }

  return (
    <div className="maya-page mx-auto w-full max-w-2xl px-4 py-8 pb-28">
      <h1 className="font-display flex items-center gap-3 text-3xl font-semibold">
        <IconBadge name="spark" />
        Выберите тариф
      </h1>
      <p className="mt-1 text-sm text-muted">{pitch.intro}</p>
      <p className="mt-2 text-sm text-muted">
        От {formatRub(BASE_MONTH_RUB)} в месяц. Если пакет чата кончится —
        доплата {CHAT_TOPUP_RUB} ₽, можно писать дальше.
      </p>

      {paidHint && (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
          Если оплата прошла — доступ включится автоматически (обновите страницу
          через несколько секунд).
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
          {error}
        </p>
      )}

      {active && current ? (
        <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            Активна: {current.label}
          </p>
          <p className="mt-1 text-xs text-muted">
            до {formatExpiry(subscription.expiresAt) ?? "—"}
          </p>
          <button
            type="button"
            onClick={() => clearSubscription()}
            className="mt-2 text-xs text-muted underline hover:text-foreground"
          >
            Сбросить подписку (тест на этом устройстве)
          </button>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-accent/30 bg-accent-soft/40 px-4 py-3 text-sm">
          <p className="font-medium">Один шаг до Маи</p>
          <p className="mt-1 text-xs text-muted">
            Выберите период ниже — после оплаты откроются чат, дневники и
            общение.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-3">
        {PAID_PLANS.map((p) => {
          const popular = p.id === "m6";
          const selected = active && subscription.planId === p.id;
          return (
            <div
              key={p.id}
              className={`relative rounded-2xl border p-4 ${
                popular
                  ? "border-accent/50 bg-accent-soft/50"
                  : "border-line bg-card/70"
              }`}
            >
              {popular && (
                <span className="absolute -top-2 right-4 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Выгодно
                </span>
              )}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{p.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{p.blurb}</p>
                  <p className="mt-2 text-[11px] text-muted">
                    ≈ {formatRub(p.perMonthRub)} / мес
                  </p>
                </div>
                <div className="text-right">
                  {p.discountPct > 0 && (
                    <p className="text-xs text-muted line-through">
                      {formatRub(p.fullPriceRub)}
                    </p>
                  )}
                  <p className="font-display text-2xl font-semibold text-foreground">
                    {formatRub(p.priceRub)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={selected || busy === p.id}
                onClick={() => void pick(p.id)}
                className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {selected
                  ? "Уже активен"
                  : busy === p.id
                    ? "Переход к оплате…"
                    : "Оплатить"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Оплата через Prodamus. Доступ привязывается к вашей почте в Мае
        {accountEmail ? ` (${accountEmail})` : ""}. Оплачивая, вы принимаете{" "}
        <Link href="/legal/offer" className="underline">
          публичную оферту
        </Link>{" "}
        и{" "}
        <Link href="/legal/privacy" className="underline">
          политику персональных данных
        </Link>
        .
      </p>
      <p className="mt-2 text-[11px] text-muted">
        Все документы:{" "}
        <Link href="/legal" className="underline">
          /legal
        </Link>
        . Услуги информационные, не заменяют консультацию врача.
      </p>

      <div className="mt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Что входит
        </p>
        <ul className="mt-2 space-y-2 text-sm text-foreground/90">
          {pitch.bullets.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-accent">✓</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">{pitch.priceNote}</p>
      </div>
    </div>
  );
}
