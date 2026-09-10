"use client";

import { ChatNewsFeed } from "@/components/ChatNewsFeed";
import { KitchenCarousel } from "@/components/KitchenCarousel";
import { SiteFeedbackBox } from "@/components/SiteFeedbackBox";
import { TodayPulse } from "@/components/TodayPulse";

/** Кухня, лента и отзыв, отдельный чанк, грузится только когда доскроллили. */
export function ChatBelowFold({
  onOpenChat,
}: {
  onOpenChat: (prefill?: string) => void;
}) {
  return (
    <div className="mt-2 space-y-5 pb-3">
      <TodayPulse variant="card" />

      <section
        id="kitchen"
        className="maya-surface scroll-mt-16 px-3.5 py-4"
        aria-label="Рецепты, шум для сна и напоминания"
      >
        <span id="noise" className="sr-only" />
        <KitchenCarousel />
      </section>

      <ChatNewsFeed onOpenChat={onOpenChat} />

      <SiteFeedbackBox />
    </div>
  );
}
