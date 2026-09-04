"use client";

import dynamic from "next/dynamic";
import { HomeQuickLog } from "@/components/HomeQuickLog";
import { HomeRhythmCard } from "@/components/HomeRhythmCard";

const ChatView = dynamic(
  () => import("@/components/ChatView").then((m) => m.ChatView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-muted">
        Мая…
      </div>
    ),
  },
);

export function HomeScreen() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <HomeQuickLog />
      <HomeRhythmCard />
      <ChatView />
    </div>
  );
}
