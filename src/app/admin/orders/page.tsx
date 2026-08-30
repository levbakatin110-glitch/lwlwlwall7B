"use client";

import Link from "next/link";

/** Админка заказов консультанта отключена. */
export default function AdminOrdersDisabledPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 px-4 py-10 text-center">
      <h1 className="font-display text-2xl font-semibold text-foreground">
        Чаты консультанта отключены
      </h1>
      <p className="text-sm text-muted">
        Услуга больше не используется. В продаже только Maya Premium.
      </p>
      <Link href="/admin" className="text-sm font-medium text-accent underline">
        ← В админку
      </Link>
    </div>
  );
}
