"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { SketchDoodles, SketchMoon } from "@/components/illustrations/MayaSketch";
import { buildChatFeed, type FeedItem } from "@/lib/chat-feed";
import { calcDiet, isDietPlanReady } from "@/lib/diet";
import { useAppStore } from "@/lib/store";

function toneBorder(item: FeedItem) {
  if (item.tone === "care") return "border-accent/20 bg-accent-soft/40";
  if (item.tone === "nudge") return "border-line bg-user-bubble/80";
  return "border-line bg-card/90";
}

export function ChatNewsFeed({
  onOpenChat,
}: {
  onOpenChat?: (prefill?: string) => void;
}) {
  const profile = useAppStore((s) => s.profile);
  const wardrobe = useAppStore((s) => s.wardrobe);
  const journals = useAppStore((s) => s.journals);
  const customModules = useAppStore((s) => s.customModules);
  const enabledModules = useAppStore((s) => s.enabledModules);
  const memories = useAppStore((s) => s.memories);
  const dietPlan = useAppStore((s) => s.dietPlan);

  const dietPlanKcal = useMemo(() => {
    if (!isDietPlanReady(dietPlan)) return null;
    return calcDiet(dietPlan).targetKcal;
  }, [dietPlan]);

  const items = useMemo(
    () =>
      buildChatFeed({
        profile,
        journals,
        customModules,
        wardrobe,
        enabledModules,
        memories,
        dietPlanKcal,
      }),
    [
      profile,
      journals,
      customModules,
      wardrobe,
      enabledModules,
      memories,
      dietPlanKcal,
    ],
  );

  function openItem(item: FeedItem) {
    if (item.kind === "insight" || item.kind === "chat" || item.kind === "stat") {
      onOpenChat?.(item.body.slice(0, 140));
    }
  }

  return (
    <section className="maya-rise relative pb-8 pt-2" aria-label="Короткий разбор">
      <SketchMoon
        tone="soft"
        className="pointer-events-none absolute -right-2 -top-2 h-16 w-16 opacity-70"
      />
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Лента
          </p>
          <h2 className="font-display mt-1 text-xl font-semibold tracking-tight text-foreground">
            Короткий разбор
          </h2>
        </div>
        <p className="max-w-[11rem] text-right text-[11px] leading-snug text-muted">
          суть из дневников, без всей истории
        </p>
      </div>
      <SketchDoodles className="mb-4 h-10 w-full max-w-md opacity-70" />

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                    {item.eyebrow}
                  </p>
                  <h3 className="font-display mt-1 text-lg font-semibold leading-tight tracking-tight">
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      {item.subtitle}
                    </p>
                  )}
                </div>
                {item.badge && (
                  <span className="shrink-0 rounded-lg bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
                    {item.badge}
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                {item.body}
              </p>

              {item.href && item.kind !== "empty" && (
                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent">
                  <MayaIcon name="growth" size={14} />
                  Открыть раздел
                </p>
              )}
            </>
          );

          const className = `block w-full rounded-[1.25rem] border p-4 text-left transition hover:border-accent/35 sm:p-5 ${toneBorder(item)}`;

          if (item.href) {
            return (
              <li key={item.id}>
                <Link href={item.href} className={className}>
                  {inner}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openItem(item)}
                className={className}
              >
                {inner}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
