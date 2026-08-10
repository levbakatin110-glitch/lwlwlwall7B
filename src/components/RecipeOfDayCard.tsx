"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { formatTime, getRecipeOfDay } from "@/lib/recipes";

export function RecipeOfDayCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  const recipe = useMemo(() => getRecipeOfDay(), []);

  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className={`group block overflow-hidden rounded-2xl border border-line bg-card/90 shadow-sm transition hover:border-accent/35 hover:bg-accent-soft/30 ${
        compact ? "p-3" : "p-4 maya-panel"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent ${
            compact ? "h-12 w-12" : "h-14 w-14"
          }`}
          aria-hidden
        >
          <MayaIcon name="diet" size={compact ? 22 : 26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Рецепт дня
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
              Открыть →
            </span>
          </p>
        </div>
      </div>
    </Link>
  );
}
