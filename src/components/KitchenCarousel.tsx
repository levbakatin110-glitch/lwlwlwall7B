"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { RecipeOfDayCard } from "@/components/RecipeOfDayCard";
import { WhiteNoiseWidget } from "@/components/WhiteNoiseWidget";

const SLIDES = 2;

/** Карусель: рецепт дня → шум (рекомендация) */
export function KitchenCarousel() {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  const go = useCallback((next: number) => {
    setIndex(((next % SLIDES) + SLIDES) % SLIDES);
  }, []);

  return (
    <div className="relative">
      <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
        <p className="text-[11px] text-muted">
          {index === 0 ? "Рецепт дня" : "Рекомендуем · виджет"}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Назад"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-600/25 bg-white/70 text-amber-900 transition hover:bg-amber-100/80 dark:border-amber-400/25 dark:bg-card/80 dark:text-amber-100 dark:hover:bg-amber-950/50"
          >
            ‹
          </button>
          <span className="min-w-[2.5rem] text-center text-[11px] font-medium text-muted">
            {index + 1}/{SLIDES}
          </span>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Вперёд"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-600/25 bg-white/70 text-amber-900 transition hover:bg-amber-100/80 dark:border-amber-400/25 dark:bg-card/80 dark:text-amber-100 dark:hover:bg-amber-950/50"
          >
            ›
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const x = e.changedTouches[0]?.clientX;
          if (x == null) return;
          const dx = x - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) < 40) return;
          go(index + (dx < 0 ? 1 : -1));
        }}
      >
        {/* Только активный слайд в потоке — иначе высота = макс. из двух и пустота под рецептом */}
        <div
          key={index}
          className="maya-item px-0.5"
        >
          {index === 0 ? <RecipeOfDayCard /> : <WhiteNoiseWidget compact />}
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
        {Array.from({ length: SLIDES }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index
                ? "w-5 bg-amber-700 dark:bg-amber-300"
                : "w-1.5 bg-amber-700/25 dark:bg-amber-300/30"
            }`}
            aria-label={`Слайд ${i + 1}`}
          />
        ))}
      </div>

      {index === 0 && (
        <p className="mt-2 text-center text-[11px] text-muted">
          Листайте → ещё шум для сна ·{" "}
          <Link href="/recipes" className="font-semibold text-amber-800 underline dark:text-amber-200">
            все рецепты
          </Link>
        </p>
      )}
    </div>
  );
}
