"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRub } from "@/lib/subscription";

type SalesBucket = { count: number; amountRub: number };
type SalesReport = {
  today: SalesBucket;
  week: SalesBucket;
  month: SalesBucket;
  all: SalesBucket;
  byPlan: { planId: string; label: string; count: number; amountRub: number }[];
  activeSubs: number;
  fakeCount: number;
  recent: {
    id: string;
    at: string;
    email: string;
    kind: "subscription" | "chat_topup";
    planId: string | null;
    amountRub: number;
    source: "prodamus" | "fake";
  }[];
};

function passHeaders(): HeadersInit {
  const admin =
    sessionStorage.getItem("maya-admin-pass") ||
    sessionStorage.getItem("maya-analytics-pass") ||
    "";
  return { "x-admin-password": admin };
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AdminSales() {
  const [data, setData] = useState<SalesReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sales", { headers: passHeaders() });
      if (res.status === 401) {
        setError("Нужен пароль админки");
        return;
      }
      if (!res.ok) throw new Error("Не удалось загрузить");
      setData((await res.json()) as SalesReport);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (error && !data) {
    return (
      <section className="mt-6 rounded-2xl border border-line bg-card/80 p-5">
        <p className="text-sm text-rose-700">{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="mt-6 rounded-2xl border border-line bg-card/80 p-5">
        <p className="text-sm text-muted">Собираю продажи…</p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-card/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Продажи
          </p>
          <p className="font-display mt-1 text-3xl font-semibold tabular-nums">
            {formatRub(data.all.amountRub)}
          </p>
          <p className="mt-1 text-sm text-muted">
            всего · {data.all.count} оплат · активных подписок {data.activeSubs}
            {data.fakeCount > 0 ? ` · из них тест ${data.fakeCount}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-[11px] text-muted underline"
        >
          Обновить
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Сегодня" bucket={data.today} />
        <Mini label="7 дней" bucket={data.week} />
        <Mini label="30 дней" bucket={data.month} />
        <Mini label="Всего" bucket={data.all} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {data.byPlan.map((p) => (
          <div
            key={p.planId}
            className="rounded-xl border border-line/70 bg-background/40 px-3 py-2"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              {p.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">
              {p.count} · {formatRub(p.amountRub)}
            </p>
          </div>
        ))}
      </div>

      {data.recent.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Пока оплат нет.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {data.recent.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-line/70 bg-background/30 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-foreground">
                {row.email}
                <span className="text-muted">
                  {" · "}
                  {row.kind === "chat_topup"
                    ? "доплата чата"
                    : row.planId || "подписка"}
                  {row.source === "fake" ? " · тест" : ""}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-muted">
                {formatRub(row.amountRub)} · {fmtWhen(row.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Mini({
  label,
  bucket,
}: {
  label: string;
  bucket: { count: number; amountRub: number };
}) {
  return (
    <div className="rounded-xl border border-line/70 bg-background/40 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">
        {formatRub(bucket.amountRub)}
      </p>
      <p className="text-[11px] text-muted">{bucket.count} шт</p>
    </div>
  );
}
