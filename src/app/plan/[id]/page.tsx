"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Чаты консультанта отключены. */
export default function PlanChatPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted">
      Мая…
    </div>
  );
}
