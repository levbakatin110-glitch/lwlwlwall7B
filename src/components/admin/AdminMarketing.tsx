"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Contact = {
  email: string;
  marketingAt: string;
  marketingEdition: string | null;
  revokedAt: string | null;
};

function passHeaders(): Record<string, string> {
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
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function downloadCsv(rows: Contact[]) {
  const lines = [
    "email;согласие;редакция",
    ...rows.map((r) => `${r.email};${r.marketingAt};${r.marketingEdition ?? ""}`),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `maya-rassylka-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminMarketing() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/marketing", { headers: passHeaders() });
      if (res.status === 401) {
        setError("Нужен пароль админки");
        return;
      }
      if (!res.ok) throw new Error("Не удалось загрузить");
      const data = (await res.json()) as { contacts?: Contact[] };
      setContacts(data.contacts ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const active = useMemo(
    () => (contacts ?? []).filter((c) => !c.revokedAt),
    [contacts],
  );

  async function revoke(email: string) {
    if (!confirm(`Отметить, что ${email} отозвал(а) согласие на рассылку?`)) {
      return;
    }
    await fetch("/api/admin/marketing", {
      method: "DELETE",
      headers: { ...passHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    void load();
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-card/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Согласны на рассылку
          </p>
          <p className="font-display mt-1 text-3xl font-semibold tabular-nums">
            {contacts ? active.length : "…"}
          </p>
          <p className="mt-1 text-sm text-muted">
            отметили галочку при регистрации
            {contacts && contacts.length > active.length
              ? ` · отозвали ${contacts.length - active.length}`
              : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={!active.length}
            onClick={() => downloadCsv(active)}
            className="text-[11px] text-accent underline disabled:opacity-40"
          >
            Скачать CSV
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="text-[11px] text-muted underline"
          >
            Обновить
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      {contacts && contacts.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Пока никто не отметил.</p>
      ) : (
        <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {(contacts ?? []).map((c) => (
            <li
              key={c.email}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-line/70 bg-background/30 px-3 py-2 text-sm"
            >
              <span
                className={`min-w-0 truncate ${c.revokedAt ? "text-muted line-through" : "text-foreground"}`}
              >
                {c.email}
              </span>
              <span className="flex shrink-0 items-baseline gap-3 text-muted">
                <span className="tabular-nums">
                  {c.revokedAt
                    ? `отозвано ${fmtWhen(c.revokedAt)}`
                    : fmtWhen(c.marketingAt)}
                </span>
                {!c.revokedAt && (
                  <button
                    type="button"
                    onClick={() => void revoke(c.email)}
                    className="text-[11px] underline"
                  >
                    Отозвал
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
