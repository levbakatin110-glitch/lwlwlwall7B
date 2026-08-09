"use client";

import Link from "next/link";
import { IconBadge } from "@/components/icons/MayaIcon";
import {
  FREE_CHAT_LIMIT,
  FREE_PERKS,
  formatExpiry,
  formatRub,
  isSubscriptionActive,
  PAID_PERKS,
  PAID_PLANS,
  planById,
  type PaidPlanId,
} from "@/lib/subscription";
import { useAppStore } from "@/lib/store";

export default function PricingPage() {
  const subscription = useAppStore((s) => s.subscription);
  const activateSubscription = useAppStore((s) => s.activateSubscription);
  const clearSubscription = useAppStore((s) => s.clearSubscription);
  const active = isSubscriptionActive(subscription);
  const current = active ? planById(subscription.planId) : null;

  function pick(id: PaidPlanId) {
    activateSubscription(id);
  }

  return (
    <div className="maya-page mx-auto w-full max-w-2xl px-4 py-8 pb-28">
      <h1 className="font-display flex items-center gap-3 text-3xl font-semibold">
        <IconBadge name="spark" />
        Подписка
      </h1>
      <p className="mt-1 text-sm text-muted">
        Бесплатно — все готовые дневники и {FREE_CHAT_LIMIT} сообщений Мае в
        день. Плюс — безлимит и свои трекеры.
      </p>

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
            Сбросить на бесплатный (тест)
          </button>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-line bg-card/60 px-4 py-3 text-sm">
          <p className="font-medium">Сейчас: бесплатный тариф</p>
          <p className="mt-1 text-xs text-muted">
            {FREE_CHAT_LIMIT} запросов к ИИ в сутки · без создания новых
            дневников
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
                  Выгоднее
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
                disabled={selected}
                onClick={() => pick(p.id)}
                className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {selected ? "Уже активен" : "Выбрать"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Оплата картой пока в подготовке (ЮKassa). Кнопка «Выбрать» включает
        тариф на этом устройстве для проверки — потом привяжем настоящую
        оплату.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Бесплатно
          </p>
          <ul className="mt-2 space-y-2 text-sm text-foreground/90">
            {FREE_PERKS.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-accent">✓</span>
                <span>{t}</span>
              </li>
            ))}
            <li className="flex gap-2 text-muted">
              <span>—</span>
              <span>Создавать свои дневники с ИИ</span>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            В подписке
          </p>
          <ul className="mt-2 space-y-2 text-sm text-foreground/90">
            {PAID_PERKS.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-accent">✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Link
        href="/"
        className="mt-10 inline-block text-sm text-accent underline"
      >
        ← К чату
      </Link>
    </div>
  );
}
