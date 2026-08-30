"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PlanOrderSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pricing");
  }, [router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted">
      Услуга консультанта отключена.{" "}
      <Link href="/pricing" className="text-accent underline">
        Maya Premium
      </Link>
    </div>
  );
}
