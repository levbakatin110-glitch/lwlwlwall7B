import dynamic from "next/dynamic";

const ChatView = dynamic(
  () => import("@/components/ChatView").then((m) => m.ChatView),
  {
    loading: () => (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-muted">
        Мая…
      </div>
    ),
  },
);

export default function HomePage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ChatView />
    </div>
  );
}
