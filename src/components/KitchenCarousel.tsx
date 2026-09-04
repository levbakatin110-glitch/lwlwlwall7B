"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RecipeOfDayCard } from "@/components/RecipeOfDayCard";
import { RemindersPeek } from "@/components/RemindersPeek";
import { WhiteNoiseWidget } from "@/components/WhiteNoiseWidget";

const SLIDES = [
  {
    title: "Рецепты",
    hint: "Каталог — без записей в дневник",
    href: "/recipes",
    all: "Все →",
  },
  {
    title: "Шум для сна",
    hint: "Белый шум, дождь, розовый",
    href: "/#noise",
    all: null,
  },
  {
    title: "Напоминания",
    hint: "Кормление, сон, прогулка",
    href: "/reminders",
    all: "Все →",
  },
] as const;

const SLIDE_MS = 5000;
const PAUSE_AFTER_TOUCH_MS = 12_000;

/** Карусель: рецепт дня → шум → напоминания */
export function KitchenCarousel() {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const pauseUntil = useRef(0);

  const go = useCallback((dir: -1 | 1) => {
    pauseUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS;
    setIndex((i) => (i + dir + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(() => {
      if (Date.now() < pauseUntil.current) return;
      if (document.visibilityState === "hidden") return;
      setIndex((i) => (i + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [index]);

  const onTouchStart = (e: React.TouchEvent) => {
    const el = e.target as HTMLElement | null;
    if (el?.closest("input, textarea, select")) {
      startX.current = null;
      return;
    }
    startX.current = e.changedTouches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const x = e.changedTouches[0]?.clientX;
    if (startX.current == null || x == null) return;
    const dx = x - startX.current;
    if (dx < -40) go(1);
    if (dx > 40) go(-1);
    startX.current = null;
  };

  const slide = SLIDES[index];

  return (
    <div className="relative">
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            {slide.title}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{slide.hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {slide.all ? (
            <Link
              href={slide.href}
              className="mr-1 text-xs font-semibold text-amber-800 underline decoration-amber-500/40 underline-offset-2 dark:text-amber-200"
            >
              {slide.all}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Назад"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-600/25 bg-white/70 text-amber-900 transition hover:bg-amber-100/80 dark:border-amber-400/25 dark:bg-card/80 dark:text-amber-100 dark:hover:bg-amber-950/50"
          >
            ‹
          </button>
          <span className="min-w-[2.5rem] text-center text-[11px] font-medium text-muted">
            {index + 1}/{SLIDES.length}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Вперёд"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-600/25 bg-white/70 text-amber-900 transition hover:bg-amber-100/80 dark:border-amber-400/25 dark:bg-card/80 dark:text-amber-100 dark:hover:bg-amber-950/50"
          >
            ›
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onPointerDown={() => {
          pauseUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS;
        }}
      >
        <div key={index} className="maya-item px-0.5">
          {index === 0 ? (
            <RecipeOfDayCard />
          ) : index === 1 ? (
            <WhiteNoiseWidget compact />
          ) : (
            <RemindersPeek />
          )}
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              pauseUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS;
              setIndex(i);
            }}
            className={`h-1.5 rounded-full transition-all ${
              i === index
                ? "w-5 bg-amber-700 dark:bg-amber-300"
                : "w-1.5 bg-amber-700/25 dark:bg-amber-300/30"
            }`}
            aria-label={`Слайд ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
