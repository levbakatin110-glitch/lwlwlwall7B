"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RecipeOfDayCard } from "@/components/RecipeOfDayCard";
import { RemindersPeek } from "@/components/RemindersPeek";
import { WhiteNoiseWidget } from "@/components/WhiteNoiseWidget";
import {
  KITCHEN_WIDGETS,
  kitchenSlideFromHash,
} from "@/lib/kitchen-widgets";

const SLIDE_MS = 5000;
const PAUSE_AFTER_TOUCH_MS = 12_000;

function scrollKitchenIntoView() {
  document
    .getElementById("kitchen")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Карусель: рецепт дня → шум → напоминания */
export function KitchenCarousel() {
  const [index, setIndex] = useState(() => {
    if (typeof window === "undefined") return 0;
    const fromHash = kitchenSlideFromHash(window.location.hash);
    return fromHash < 0 ? 0 : fromHash;
  });
  const startX = useRef<number | null>(null);
  const pauseUntil = useRef(0);

  const go = useCallback((dir: -1 | 1) => {
    pauseUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS;
    setIndex((i) => (i + dir + KITCHEN_WIDGETS.length) % KITCHEN_WIDGETS.length);
  }, []);

  useEffect(() => {
    const applyHash = () => {
      const next = kitchenSlideFromHash(window.location.hash);
      if (next < 0) return;
      pauseUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS;
      setIndex(next);
      window.setTimeout(scrollKitchenIntoView, 40);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
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
      setIndex((i) => (i + 1) % KITCHEN_WIDGETS.length);
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

  const slide = KITCHEN_WIDGETS[index];

  return (
    <div className="relative">
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            {slide.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {slide.catalogHref && slide.catalogLabel ? (
            <Link
              href={slide.catalogHref}
              className="mr-1 text-xs font-semibold text-accent underline decoration-accent/35 underline-offset-2"
            >
              {slide.catalogLabel}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Назад"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-foreground transition hover:border-accent/35 hover:bg-accent-soft"
          >
            ‹
          </button>
          <span className="min-w-[2.5rem] text-center text-xs font-medium tabular-nums text-muted">
            {index + 1}/{KITCHEN_WIDGETS.length}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Вперёд"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-foreground transition hover:border-accent/35 hover:bg-accent-soft"
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
        {KITCHEN_WIDGETS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              pauseUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS;
              setIndex(i);
            }}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-5 bg-accent" : "w-1.5 bg-accent/25"
            }`}
            aria-label={item.title}
          />
        ))}
      </div>
    </div>
  );
}
