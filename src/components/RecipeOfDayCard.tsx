"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { formatTime, getRecipeOfDay } from "@/lib/recipes";

/** Фишка в чате — не дневник, а идея «что приготовить сегодня» */
export function RecipeOfDayCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  const recipe = useMemo(() => getRecipeOfDay(), []);

  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className={`group relative block overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent-soft/80 via-card to-card shadow-sm transition hover:border-accent/45 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-accent/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <span
          className={`flex shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent ${
            compact ? "h-11 w-11" : "h-12 w-12"
          }`}
          aria-hidden
        >
          <MayaIcon name="spark" size={compact ? 18 : 20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Фишка · рецепт дня
          </p>
          <p
            className={`font-display mt-0.5 font-semibold leading-snug text-foreground ${
              compact ? "text-base" : "text-lg"
            }`}
          >
            {recipe.title}
          </p>
          {!compact && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">
              {recipe.teaser}
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
            <span>{formatTime(recipe.timeMin)}</span>
            <span aria-hidden>·</span>
            <span>{recipe.servings}</span>
            <span className="ml-auto font-semibold text-accent group-hover:underline">
              Смотреть →
            </span>
          </p>
        </div>
      </div>
    </Link>
  );
}
