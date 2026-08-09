"use client";

import { EmailGate } from "@/components/EmailGate";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Отдельная страница регистрации — всегда можно открыть руками */
export default function RegisterPage() {
  const emailVerified = useAppStore((s) => s.emailVerified);
  const accountEmail = useAppStore((s) => s.accountEmail);
  const router = useRouter();

  useEffect(() => {
    if (emailVerified && accountEmail) {
      router.replace("/");
    }
  }, [emailVerified, accountEmail, router]);

  if (emailVerified && accountEmail) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted">
        Уже зарегистрированы…
      </div>
    );
  }

  return <EmailGate>{null}</EmailGate>;
}
