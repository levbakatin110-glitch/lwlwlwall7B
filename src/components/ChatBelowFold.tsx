"use client";

import { ChatNewsFeed } from "@/components/ChatNewsFeed";
import { KitchenCarousel } from "@/components/KitchenCarousel";
import { SiteFeedbackBox } from "@/components/SiteFeedbackBox";
import { TodayPulse } from "@/components/TodayPulse";

/** Кухня, лента и отзыв — отдельный чанк, грузится только когда доскроллили. */
export function ChatBelowFold({
  onOpenChat,
}: {
  onOpenChat: (prefill?: string) => void;
}) {
  return (
    <div className="mt-1 space-y-4 pb-2">
      <TodayPulse variant="card" />

      <section
        id="noise"
        className="rounded-[1.5rem] border border-amber-500/25 bg-gradient-to-br from-amber-50/90 via-[#fff8ee] to-orange-50/50 px-3.5 py-4 dark:border-amber-400/20 dark:from-amber-950/40 dark:via-card dark:to-orange-950/20"
        aria-label="Рецепты, шум для сна и напоминания"
      >
        <KitchenCarousel />
      </section>

      <ChatNewsFeed onOpenChat={onOpenChat} />

      <SiteFeedbackBox />
    </div>
  );
}
