"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  formatTime,
  getRecipeBySlug,
  otherRecipes,
} from "@/lib/recipes";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { useAppStore } from "@/lib/store";

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const setPendingChatPrompt = useAppStore((s) => s.setPendingChatPrompt);
  const slug = String(params.slug ?? "");
  const recipe = useMemo(() => getRecipeBySlug(slug), [slug]);
  const more = useMemo(() => otherRecipes(slug, 5), [slug]);

  if (!recipe) {
    return (
      <div className="maya-page mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-display text-xl font-semibold">Рецепт не найден</p>
        <Link href="/recipes" className="mt-4 inline-block text-accent underline">
          Ко всем рецептам
        </Link>
      </div>
    );
  }

  function askMaya() {
    setPendingChatPrompt(
      `Подскажи по рецепту «${recipe!.title}»: как упростить, чем заменить продукты и подойдёт ли при ГВ?`,
    );
    router.push("/");
  }

  return (
    <div className="maya-page mx-auto w-full max-w-2xl px-4 py-8 pb-28">
      <Link
        href="/recipes"
        className="text-sm font-medium text-muted transition hover:text-accent"
      >
        ← Все рецепты
      </Link>

      <div className="mt-5 flex items-start gap-4">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent"
          aria-hidden
        >
          <MayaIcon name="diet" size={30} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Рецепт
          </p>
          <h1 className="font-display mt-1 text-2xl font-semibold leading-tight sm:text-3xl">
            {recipe.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {recipe.teaser}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span>{formatTime(recipe.timeMin)}</span>
            <span>{recipe.servings}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {recipe.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-line bg-card/70 px-2.5 py-0.5 text-[11px] text-muted"
          >
            {tag}
          </span>
        ))}
      </div>

      <section className="mt-6 rounded-2xl border border-accent/20 bg-accent-soft/40 px-4 py-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
          Почему удобно маме
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
          {recipe.whyMom}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Ингредиенты</h2>
        <ul className="mt-3 space-y-2">
          {recipe.ingredients.map((item) => (
            <li
              key={item}
              className="flex gap-2.5 text-sm leading-relaxed text-foreground/90"
            >
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Как готовить</h2>
        <ol className="mt-3 space-y-4">
          {recipe.steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
                {i + 1}
              </span>
              <p className="pt-0.5 text-sm leading-relaxed text-foreground/90">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {recipe.tip && (
        <section className="mt-8 rounded-2xl border border-line bg-card/70 px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Совет Маи
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
            {recipe.tip}
          </p>
        </section>
      )}

      <button
        type="button"
        onClick={askMaya}
        className="mt-8 flex w-full items-center justify-center rounded-2xl bg-accent py-3.5 text-sm font-semibold text-on-accent transition hover:bg-accent-hot"
      >
        Спросить Маю про этот рецепт
      </button>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Ещё блюда</h2>
          <Link
            href="/recipes"
            className="text-xs font-semibold text-accent hover:underline"
          >
            Все рецепты
          </Link>
        </div>
        <ul className="mt-4 flex flex-col gap-2.5">
          {more.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/recipes/${r.slug}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card/70 px-3 py-3 transition hover:border-accent/30"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"
                  aria-hidden
                >
                  <MayaIcon name="diet" size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="text-[11px] text-muted">
                    {formatTime(r.timeMin)}
                  </p>
                </div>
                <span className="text-accent">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
