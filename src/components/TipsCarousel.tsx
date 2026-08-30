"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { buildInsights } from "@/lib/insights";
import { MODULE_BY_ID } from "@/lib/modules";
import { useAppStore } from "@/lib/store";
import type { ModuleId } from "@/lib/types";

export const CHAT_PROMPTS = [
  {
    label: "Что надеть малышу на прогулку?",
    prompt:
      "Хочу выйти погулять с малышом — во что его одеть под сегодняшнюю погоду?",
  },
  {
    label: "Как спит мой малыш",
    prompt:
      "Хочу отслеживать, как мой малыш спит — создай или подключи дневник сна, буду писать ночные и дневные сны",
  },
  {
    label: "Вести прикорм",
    prompt:
      "Хочу вести дневник прикорма: что пробовали, сколько и как отреагировал малыш",
  },
] as const;

type FeedCard = {
  id: string;
  kind: "entry" | "insight" | "empty" | "setup";
  title: string;
  subtitle?: string;
  body: string;
  badge?: string;
  href?: string;
  tone?: "care" | "nudge" | "notice";
};

function parseMetric(raw: string): number | null {
  const m = String(raw)
    .replace(",", ".")
    .match(/([+-]?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function TipsCarousel({
  onOpenChat,
}: {
  onOpenChat?: (prefill?: string) => void;
}) {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const wardrobe = useAppStore((s) => s.wardrobe);
  const journals = useAppStore((s) => s.journals);
  const customModules = useAppStore((s) => s.customModules);
  const enabledModules = useAppStore((s) => s.enabledModules);
  const messages = useAppStore((s) => s.messages);

  const insights = useMemo(
    () =>
      buildInsights({
        profile,
        journals,
        customModules,
        wardrobe,
        enabledModules,
      }),
    [profile, journals, customModules, wardrobe, enabledModules],
  );

  const cards = useMemo(() => {
    const list: FeedCard[] = [];

    // Реальные записи из дневников (свежие сверху)
    const recentEntries: {
      moduleId: string;
      title: string;
      date: string;
      value: string;
      note: string;
      icon: string;
    }[] = [];

    for (const id of enabledModules) {
      const mod = MODULE_BY_ID[id as ModuleId];
      if (!mod) continue;
      for (const e of (journals[id] ?? []).slice(0, 4)) {
        recentEntries.push({
          moduleId: id,
          title: mod.title,
          date: e.date,
          value: e.value,
          note: e.note || "",
          icon: mod.icon,
        });
      }
    }
    for (const mod of customModules) {
      for (const e of (journals[mod.id] ?? []).slice(0, 3)) {
        recentEntries.push({
          moduleId: mod.id,
          title: mod.title,
          date: e.date,
          value: e.value,
          note: e.note || "",
          icon: mod.icon || "spark",
        });
      }
    }
    recentEntries.sort((a, b) => b.date.localeCompare(a.date));

    for (const e of recentEntries.slice(0, 8)) {
      const n = parseMetric(e.value);
      const sameModule = recentEntries.filter((x) => x.moduleId === e.moduleId);
      const prev = sameModule.find((x) => x.date < e.date);
      const prevN = prev ? parseMetric(prev.value) : null;
      let badge: string | undefined;
      if (n != null && prevN != null) {
        const d = Number((n - prevN).toFixed(1));
        if (d !== 0) badge = `${d > 0 ? "+" : ""}${d}`;
      } else if (e.value.trim().startsWith("+") || e.value.trim().startsWith("-")) {
        badge = e.value.trim().split(/\s+/)[0];
      }

      list.push({
        id: `entry-${e.moduleId}-${e.date}-${e.value}`,
        kind: "entry",
        title: e.title,
        subtitle: e.date,
        body: e.note ? `${e.value} · ${e.note}` : e.value,
        badge,
        href: `/m/${e.moduleId}`,
        tone: "care",
      });
    }

    // Что только что записали в чате (если ещё не в списке)
    for (const m of [...messages].reverse()) {
      if (!m.loggedEntries?.length) continue;
      for (const e of m.loggedEntries) {
        const id = `chat-${e.moduleId}-${e.date}-${e.value}`;
        if (list.some((c) => c.id === id || c.body.startsWith(e.value))) continue;
        list.unshift({
          id,
          kind: "entry",
          title: e.title,
          subtitle: "из чата с Маей",
          body: e.note ? `${e.value} · ${e.note}` : e.value,
          badge: e.value.trim().match(/^[+-][\d.,]+/)?.[0],
          href: `/m/${e.moduleId}`,
          tone: "care",
        });
      }
    }

    for (const i of insights) {
      list.push({
        id: i.id,
        kind: "insight",
        title: "Мая заметила",
        body: i.text,
        tone: i.tone,
      });
    }

    if (!profile.city?.trim() || wardrobe.filter((w) => !w.id.startsWith("demo-")).length === 0) {
      list.push({
        id: "setup",
        kind: "setup",
        title: "Чтобы советы были точнее",
        body: "Добавьте вещи в гардероб — Мая подскажет по погоде с вашего места.",
        href: "/wardrobe",
        tone: "nudge",
      });
    }

    // Уникальность
    const seen = new Set<string>();
    const unique = list.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    if (!unique.length) {
      return [
        {
          id: "empty",
          kind: "empty" as const,
          title: "Пока тихо",
          body: "Напишите Мае про сон, рост или прогулку — сюда начнут попадать живые записи из вашего общения.",
          tone: "notice" as const,
        },
      ];
    }

    return unique.slice(0, 12);
  }, [
    enabledModules,
    journals,
    customModules,
    messages,
    insights,
    profile.city,
    wardrobe,
  ]);

  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const deltaX = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, cards.length - 1)));
  }, [cards.length]);

  const go = useCallback(
    (next: number) => {
      if (!cards.length) return;
      const i = ((next % cards.length) + cards.length) % cards.length;
      setIndex(i);
    },
    [cards.length],
  );

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = true;
    startX.current = e.clientX;
    deltaX.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current || !trackRef.current) return;
    deltaX.current = e.clientX - startX.current;
    trackRef.current.style.transition = "none";
    trackRef.current.style.transform = `translateX(calc(${-index * 100}% + ${deltaX.current}px))`;
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = deltaX.current;
    if (trackRef.current) {
      trackRef.current.style.transition = "";
      trackRef.current.style.transform = "";
    }
    if (dx < -56) go(index + 1);
    else if (dx > 56) go(index - 1);
    else if (Math.abs(dx) < 10) {
      const c = cards[index];
      if (!c) {
        /* skip */
      } else if (c.kind === "setup" && c.href) {
        router.push(c.href);
      } else if (onOpenChat) {
        const prefill =
          c.kind === "entry"
            ? `Расскажи про эту запись: ${c.title} — ${c.body.split(" · ")[0]}`
            : c.kind === "insight"
              ? c.body.slice(0, 120)
              : undefined;
        onOpenChat(prefill);
      }
    }
    deltaX.current = 0;
  }

  const card = cards[index];
  if (!card) return null;

  function toneClass(c: FeedCard) {
    return c.tone === "care"
      ? "border-line bg-user-bubble"
      : c.tone === "nudge"
        ? "border-accent/25 bg-accent-soft/80"
        : "border-line bg-card";
  }

  return (
    <div className="maya-rise select-none">
      <div className="mb-2.5 flex items-center justify-between gap-3 px-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          Ваша лента
        </p>
        {cards.length > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Назад"
              onClick={() => go(index - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-card text-sm font-semibold text-muted hover:text-foreground"
            >
              ‹
            </button>
            <span className="min-w-[2.75rem] text-center font-mono text-[11px] text-muted">
              {index + 1}/{cards.length}
            </span>
            <button
              type="button"
              aria-label="Вперёд"
              onClick={() => go(index + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-card text-sm font-semibold text-muted hover:text-foreground"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[1.35rem]">
        <div
          ref={trackRef}
          className="flex touch-pan-y transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {cards.map((c) => (
            <article
              key={c.id}
              role={onOpenChat ? "button" : undefined}
              tabIndex={onOpenChat ? 0 : undefined}
              onKeyDown={
                onOpenChat
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const prefill =
                          c.kind === "entry"
                            ? `Расскажи про эту запись: ${c.title} — ${c.body.split(" · ")[0]}`
                            : undefined;
                        onOpenChat(prefill);
                      }
                    }
                  : undefined
              }
              className={`w-full shrink-0 border p-4 sm:p-5 ${toneClass(c)} ${
                onOpenChat ? "cursor-pointer" : ""
              }`}
            >
              <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                        {c.kind === "entry"
                          ? "Записано в дневник"
                          : c.kind === "insight"
                            ? "Мая заметила"
                            : c.kind === "setup"
                              ? "Подсказка"
                              : "Лента"}
                      </p>
                      <h3 className="font-display mt-1 text-lg font-semibold leading-tight tracking-tight">
                        {c.title}
                      </h3>
                      {c.subtitle && (
                        <p className="mt-0.5 font-mono text-[11px] text-muted">
                          {c.subtitle}
                        </p>
                      )}
                    </div>
                    {c.badge && (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
                        {c.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                    {c.kind === "entry" ? (
                      <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
                        {c.body.split(" · ")[0]}
                      </span>
                    ) : (
                      c.body
                    )}
                  </p>
                  {c.kind === "entry" && c.body.includes(" · ") && (
                    <p className="mt-1 text-xs text-muted">
                      {c.body.split(" · ").slice(1).join(" · ")}
                    </p>
                  )}
                  {c.kind === "setup" && c.href ? (
                    <p className="mt-3 text-sm font-semibold text-accent">
                      В гардероб →
                    </p>
                  ) : onOpenChat ? (
                    <p className="mt-3 text-sm font-semibold text-accent">
                      Открыть в чате →
                    </p>
                  ) : null}
                  {!onOpenChat && c.href && c.kind !== "setup" && (
                    <Link
                      href={c.href}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                    >
                      <MayaIcon name="growth" size={14} />
                      Открыть
                    </Link>
                  )}
                </div>
            </article>
          ))}
        </div>
      </div>

      {cards.length > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {cards.map((c, i) => (
            <button
              key={c.id}
              type="button"
              aria-label={`Карточка ${i + 1}`}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-accent" : "w-1.5 bg-foreground/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
