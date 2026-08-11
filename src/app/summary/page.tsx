"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { IconBadge, MayaIcon } from "@/components/icons/MayaIcon";
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
import { openDoctorReportPdf } from "@/lib/doctor-report";
import {
  canSendAiChat,
  FREE_CHAT_LIMIT,
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
  pick("diaper", "Подгузник");
  pick("notes", "Заметки");
  return lines;
}

export default function SummaryPage() {
  const journals = useAppStore((s) => s.journals);
  const profile = useAppStore((s) => s.profile);
  const enabledModules = useAppStore((s) => s.enabledModules);
  const customModules = useAppStore((s) => s.customModules);
  const wardrobe = useAppStore((s) => s.wardrobe);
  const memories = useAppStore((s) => s.memories);
  const memoryStory = useAppStore((s) => s.memoryStory);
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
      setVerdictError(
        `На сегодня лимит бесплатных сообщений (${FREE_CHAT_LIMIT}). Завтра снова или оформите подписку.`,
      );
      return;
    }
    if (!consumeAiChatQuota()) {
      setVerdictError(
        `На сегодня лимит бесплатных сообщений (${FREE_CHAT_LIMIT}). Завтра снова или оформите подписку.`,
      );
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
            memories,
            memoryStory,
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
      <div className="flex items-start justify-between gap-3">
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
        <button
          type="button"
          onClick={() =>
            openDoctorReportPdf({
              profile,
              journals,
              date,
              verdict: shownVerdict,
            })
          }
          className="shrink-0 rounded-xl border border-line bg-card/80 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-accent/40"
        >
          PDF врачу
        </button>
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

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
          className="col-span-2 sm:col-span-1"
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
