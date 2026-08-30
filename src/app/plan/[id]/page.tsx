"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Чаты консультанта отключены — проект не запускался. */
export default function PlanChatPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted">
      <p>Чат с консультантом больше не доступен.</p>
      <Link href="/" className="font-medium text-accent underline">
        К Мае
      </Link>
    </div>
  );
}
