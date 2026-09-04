"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { IconBadge, MayaIcon } from "@/components/icons/MayaIcon";
import { PlanOfferBanner } from "@/components/plan/PlanOffer";
import { childDisplayName } from "@/lib/children";
import {
  ageLabelRu,
  buildDaySummary,
  dayNormHints,
  formatDayLabel,
  formatDaySummaryBrief,
  formatDurationRu,
  shiftIsoDate,
  todayIso,
  type DayEventKind,
} from "@/lib/day-summary";
import { buildDayRhythm } from "@/lib/day-rhythm";
import {
  canSendAiChat,
} from "@/lib/subscription";
import { useAppStore } from "@/lib/store";
import type { IconName } from "@/lib/icons";
import type { JournalEntry } from "@/lib/types";

const KIND_META: Record<
  DayEventKind,
  { icon: IconName; href: string; tone: string }
> = {
  sleep: {
    icon: "sleep",
    href: "/m/sleep",
    tone: "bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-accent",
  },
  breastfeeding: {
    icon: "feeding",
    href: "/m/breastfeeding",
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  formula: {
    icon: "formula",
    href: "/m/formula",
    tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  solids: {
    icon: "solids",
    href: "/m/solids",
    tone: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  },
  growth: {
    icon: "growth",
    href: "/m/growth",
    tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  diaper: {
    icon: "diaper",
    href: "/m/diaper",
    tone: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  },
};

function extrasForDay(
  date: string,
  journals: Record<string, JournalEntry[]>,
): string[] {
  const lines: string[] = [];
  const pick = (id: string, label: string) => {
    const list = (journals[id] ?? []).filter((e) => e.date === date);
    if (!list.length) return;
    const vals = list
      .slice(0, 8)
      .map((e) => e.value)
      .join("; ");
    lines.push(`${label}: ${vals}`);
  };
  pick("water", "Вода");
  pick("walk", "Прогулка");
  pick("notes", "Заметки");
  return lines;
}

export default function SummaryPage() {
  const journals = useAppStore((s) => s.journals);
  const profile = useAppStore((s) => s.profile);
  const enabledModules = useAppStore((s) => s.enabledModules);
  const customModules = useAppStore((s) => s.customModules);
  const wardrobe = useAppStore((s) => s.wardrobe);
  const subscription = useAppStore((s) => s.subscription);
  const aiChatUsage = useAppStore((s) => s.aiChatUsage);
  const consumeAiChatQuota = useAppStore((s) => s.consumeAiChatQuota);
  const refundAiChatQuota = useAppStore((s) => s.refundAiChatQuota);

  const [date, setDate] = useState(todayIso);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [verdictError, setVerdictError] = useState<string | null>(null);
  const [verdictForDate, setVerdictForDate] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { totals, events } = useMemo(
    () => buildDaySummary({ date, journals }),
    [date, journals],
  );
  const hints = useMemo(
    () => dayNormHints({ birthDate: profile.birthDate, totals }),
    [profile.birthDate, totals],
  );
  const rhythm = useMemo(
    () => buildDayRhythm(journals),
    [journals],
  );

  const name = childDisplayName(profile);
  const age = ageLabelRu(profile.birthDate);
  const isToday = date === todayIso();
  const feedCount = totals.bfCount + totals.formulaCount;
  const shownVerdict = verdictForDate === date ? verdict : null;

  function askMayaVerdict() {
    if (pending) return;
    setVerdictError(null);

    const gate = canSendAiChat(subscription, aiChatUsage);
    if (!gate.ok) {
      setVerdictError("Итог дня с Маей — только с Premium. Оформите подписку.");
      return;
    }
    if (!consumeAiChatQuota()) {
      setVerdictError("Итог дня с Маей — только с Premium. Оформите подписку.");
      return;
    }

    const brief = formatDaySummaryBrief({
      name,
      age,
      dateLabel: formatDayLabel(date),
      totals,
      events,
      hints,
      extraLines: extrasForDay(date, journals),
    });

    const prompt = `Посмотри итоги дня малыша и скажи простыми словами маме: как прошёл день — нормально ли в целом или на что обратить внимание.

Правила ответа:
- 4–7 коротких предложений, тёплым тоном «как мама маме»
- Без паники и диагнозов; если мало данных — честно скажи, что рано судить
- Не заменяй педиатра
- Можно 1 мягкий совет, что записать завтра

Данные:
${brief}`;

    setVerdict("");
    setVerdictForDate(date);

    startTransition(async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            profile,
            enabledModules,
            customModules,
            wardrobe: wardrobe.map((w) => ({
              id: w.id,
              name: w.name,
              type: w.type,
              season: w.season,
              note: w.note,
              imageData: w.imageData ? "[photo]" : undefined,
              tempMinC: w.tempMinC,
              tempMaxC: w.tempMaxC,
              weatherTags: w.weatherTags,
              aiDescription: w.aiDescription,
            })),
            journals,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error || `Ошибка (${res.status})`);
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error("Нет ответа");
        const decoder = new TextDecoder();
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setVerdict(full.trim());
        }
        if (!full.trim()) {
          throw new Error("Пустой ответ");
        }
      } catch (err) {
        refundAiChatQuota();
        setVerdict(null);
        setVerdictForDate(null);
        setVerdictError(
          err instanceof Error ? err.message : "Не удалось спросить Маю",
        );
      }
    });
  }

  return (
    <div className="maya-page mx-auto w-full max-w-2xl px-4 py-8 pb-28">
      <div>
        <h1 className="font-display flex items-center gap-3 text-3xl font-semibold">
          <IconBadge name="list" />
          Итоги дня
        </h1>
        <p className="mt-1 text-sm text-muted">
          {name}
          {age ? ` · ${age}` : ""}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setDate((d) => shiftIsoDate(d, -1))}
          className="rounded-xl border border-line bg-card/70 px-3 py-2 text-sm text-muted hover:text-foreground"
          aria-label="Предыдущий день"
        >
          ←
        </button>
        <div className="text-center">
          <p className="font-display text-lg font-semibold capitalize">
            {formatDayLabel(date)}
          </p>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(todayIso())}
              className="mt-0.5 text-xs text-accent underline"
            >
              Сегодня
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDate((d) => shiftIsoDate(d, 1))}
          disabled={isToday}
          className="rounded-xl border border-line bg-card/70 px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-30"
          aria-label="Следующий день"
        >
          →
        </button>
      </div>

      {isToday && (rhythm.nextFeed || rhythm.nextSleep) ? (
        <div className="mt-5 rounded-2xl border border-accent/25 bg-accent-soft/40 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            По вашему ритму
          </p>
          {rhythm.nextFeed ? (
            <p className="mt-1.5 text-sm font-medium text-foreground">
              {rhythm.nextFeed.label}
            </p>
          ) : null}
          {rhythm.nextSleep ? (
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {rhythm.nextSleep.label}
            </p>
          ) : null}
        </div>
      ) : null}

      {isToday ? (
        <p
          className={`mt-3 text-sm leading-relaxed ${
            rhythm.compare.tone === "watch"
              ? "text-amber-800 dark:text-amber-200"
              : "text-muted"
          }`}
        >
          {rhythm.compare.phrase}
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Сон"
          value={
            totals.sleepSec > 0 ? formatDurationRu(totals.sleepSec) : "—"
          }
          hint={
            totals.sleepCount
              ? `${totals.sleepCount} запис.`
              : "нет записей"
          }
          href="/m/sleep"
          icon="sleep"
        />
        <StatTile
          label="Кормления"
          value={feedCount > 0 ? String(feedCount) : "—"}
          hint={
            [
              totals.bfCount ? `ГВ ${totals.bfCount}` : null,
              totals.formulaCount ? `смесь ${totals.formulaCount}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "нет записей"
          }
          href="/m/breastfeeding"
          icon="feeding"
        />
        <StatTile
          label="Смесь"
          value={totals.formulaMl > 0 ? `${totals.formulaMl} мл` : "—"}
          hint={
            totals.formulaCount
              ? `${totals.formulaCount} раз`
              : "нет записей"
          }
          href="/m/formula"
          icon="formula"
        />
        <StatTile
          label="Подгузник"
          value={totals.diaperCount > 0 ? String(totals.diaperCount) : "—"}
          hint={
            totals.diaperCount
              ? `мокрых ${totals.diaperWet} · грязных ${totals.diaperDirty}`
              : "нет записей"
          }
          href="/m/diaper"
          icon="diaper"
        />
      </div>

      {(totals.bfSec > 0 || totals.sleepNapSec > 0 || totals.sleepNightSec > 0) && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {totals.sleepNightSec > 0 && (
            <>Ночной сон {formatDurationRu(totals.sleepNightSec)}. </>
          )}
          {totals.sleepNapSec > 0 && (
            <>Дневной {formatDurationRu(totals.sleepNapSec)}. </>
          )}
          {totals.bfSec > 0 && (
            <>
              ГВ суммарно {formatDurationRu(totals.bfSec)}
              {totals.bfLeftSec > 0 || totals.bfRightSec > 0
                ? ` (Л ${formatDurationRu(totals.bfLeftSec)} / П ${formatDurationRu(totals.bfRightSec)})`
                : ""}
              .
            </>
          )}
        </p>
      )}

      <div className="mt-6 space-y-2">
        {hints.map((h) => (
          <div
            key={h.id}
            className={`rounded-2xl border px-4 py-3 text-sm ${
              h.tone === "ok"
                ? "border-emerald-500/25 bg-emerald-500/10"
                : h.tone === "watch"
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-line bg-card/60"
            }`}
          >
            <p className="font-medium text-foreground">{h.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{h.detail}</p>
          </div>
        ))}
      </div>

      {hints.some((h) => h.tone === "watch") ? (
        <div className="mt-4">
          <PlanOfferBanner
            moduleId={
              hints.some((h) => h.id.startsWith("feed"))
                ? "breastfeeding"
                : "sleep"
            }
          />
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-accent/25 bg-accent-soft/40 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
          Мнение Маи
        </p>
        <button
          type="button"
          onClick={askMayaVerdict}
          disabled={pending}
          className="mt-3 w-full rounded-2xl bg-accent py-3 text-sm font-semibold text-on-accent disabled:opacity-60"
        >
          {pending ? "Мая думает…" : "Как прошёл день?"}
        </button>
        {verdictError && (
          <p className="mt-3 text-sm text-blush">{verdictError}</p>
        )}
        {(shownVerdict || pending) && (
          <div className="mt-3 rounded-2xl border border-line bg-card/90 px-4 py-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {shownVerdict || "…"}
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-end justify-between gap-3">
        <p className="font-display text-xl font-semibold">Лента</p>
        <Link
          href="/m/sleep"
          className="text-xs font-medium text-accent underline"
        >
          + запись
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-card/40 px-4 py-8 text-center">
          <p className="text-sm text-muted">За этот день записей пока нет.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link
              href="/m/sleep"
              className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white"
            >
              Сон
            </Link>
            <Link
              href="/m/breastfeeding"
              className="rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold"
            >
              ГВ
            </Link>
            <Link
              href="/m/formula"
              className="rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold"
            >
              Смесь
            </Link>
            <Link
              href="/m/diaper"
              className="rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold"
            >
              Подгузник
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {events.map((ev, i) => {
            const meta = KIND_META[ev.kind];
            return (
              <li
                key={ev.id}
                className="maya-item"
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <Link
                  href={meta.href}
                  className="flex items-center gap-3 rounded-full border border-line bg-card/85 px-3 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:border-accent/30"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.tone}`}
                  >
                    <MayaIcon name={meta.icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {ev.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">
                      {ev.detail}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-[11px] leading-relaxed text-muted">
        Ориентиры по возрасту — очень приблизительные и не заменяют педиатра.
        Смотрите на вес, подгузники и самочувствие малыша.
      </p>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  href,
  icon,
  className = "",
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
  icon: IconName;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border border-line bg-card/70 p-3 transition hover:border-accent/35 ${className}`}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        <MayaIcon name={icon} size={14} />
        {label}
      </div>
      <p className="font-display mt-2 text-xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
    </Link>
  );
}
