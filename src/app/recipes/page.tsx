"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IconBadge, MayaIcon } from "@/components/icons/MayaIcon";
import { RecipeOfDayCard } from "@/components/RecipeOfDayCard";
import {
  formatTime,
  getRecipeOfDay,
  RECIPES,
  type RecipeTag,
} from "@/lib/recipes";

const FILTERS: { id: "all" | RecipeTag; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "быстро", label: "Быстро" },
  { id: "для мамы", label: "Для мамы" },
  { id: "семья", label: "Семья" },
  { id: "прикорм", label: "Прикорм" },
  { id: "завтрак", label: "Завтрак" },
  { id: "обед", label: "Обед" },
  { id: "ужин", label: "Ужин" },
  { id: "перекус", label: "Перекус" },
  { id: "без духовки", label: "Без духовки" },
];

function isRecipeTag(value: string): value is RecipeTag {
  return FILTERS.some((f) => f.id === value && f.id !== "all");
}

export default function RecipesPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const ofDay = useMemo(() => getRecipeOfDay(), []);

  useEffect(() => {
    const tag = new URLSearchParams(window.location.search).get("tag") ?? "";
    if (isRecipeTag(tag)) setFilter(tag);
  }, []);

  const list = useMemo(() => {
    if (filter === "all") return RECIPES;
    return RECIPES.filter((r) => r.tags.includes(filter));
  }, [filter]);

  function pickFilter(id: (typeof FILTERS)[number]["id"]) {
    setFilter(id);
    const url =
      id === "all" ? "/recipes" : `/recipes?tag=${encodeURIComponent(id)}`;
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="maya-page mx-auto w-full max-w-2xl px-4 py-8 pb-28">
      <h1 className="font-display flex items-center gap-3 text-3xl font-semibold">
        <IconBadge name="diet" />
        Рецепты
      </h1>
      <p className="mt-2 text-sm text-muted">
        Каталог блюд для мамы и семьи — просто смотрите и готовьте. Записи вести не
        нужно; в чате можно спросить Маю про замены и прикорм.
      </p>

      <div className="mt-6">
        <RecipeOfDayCard />
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto overscroll-x-none pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => pickFilter(f.id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-accent bg-accent text-on-accent"
                  : "border-line bg-card/70 text-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <ul className="mt-5 flex flex-col gap-3">
        {list.map((recipe) => {
          const isToday = recipe.slug === ofDay.slug;
          return (
            <li key={recipe.slug}>
              <Link
                href={`/recipes/${recipe.slug}`}
                className="flex items-start gap-3 rounded-2xl border border-line bg-card/80 p-3.5 transition hover:border-accent/30 hover:bg-accent-soft/25"
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"
                  aria-hidden
                >
                  <MayaIcon name="diet" size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold leading-snug">
                      {recipe.title}
                    </h2>
                    {isToday && (
                      <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                        сегодня
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">
                    {recipe.teaser}
                  </p>
                  <p className="mt-2 text-[11px] text-muted">
                    {formatTime(recipe.timeMin)} · {recipe.servings}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {list.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted">
          В этой категории пока пусто — выберите другой фильтр.
        </p>
      )}
    </div>
  );
}
