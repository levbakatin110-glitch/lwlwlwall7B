"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PlanOrderSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pricing");
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted">
      Мая…
    </div>
  );
}
