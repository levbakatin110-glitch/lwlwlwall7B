"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  validateCustomModule,
  type BlueprintHealth,
} from "@/lib/blueprint-health";
import type { OpsErrorLog } from "@/lib/ops-log";
import { useAppStore } from "@/lib/store";
import type { CustomModule, ModuleBlueprint } from "@/lib/types";

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

export default function AdminPage() {
  const customModules = useAppStore((s) => s.customModules);
  const opsErrors = useAppStore((s) => s.opsErrors);
  const clearOpsErrors = useAppStore((s) => s.clearOpsErrors);
  const healCustomModulesLocally = useAppStore((s) => s.healCustomModulesLocally);
  const updateCustomModuleFromBlueprint = useAppStore(
    (s) => s.updateCustomModuleFromBlueprint,
  );
  const pushOpsError = useAppStore((s) => s.pushOpsError);

  const [serverErrors, setServerErrors] = useState<OpsErrorLog[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const healthRows = useMemo(
    () =>
      customModules.map((m) => ({
        mod: m,
        health: validateCustomModule(m),
      })),
    [customModules],
  );

  const broken = healthRows.filter(
    (r) => !r.health.ok || r.health.issues.length > 0,
  );

  async function refreshServer() {
    try {
      const res = await fetch("/api/ops-log");
      const data = (await res.json()) as { errors?: OpsErrorLog[] };
      setServerErrors(data.errors ?? []);
    } catch {
      setServerErrors([]);
    }
  }

  useEffect(() => {
    void refreshServer();
  }, []);

  async function repairOne(mod: CustomModule, forceAi = false) {
    setBusyId(mod.id);
    setNote(null);
    try {
      const res = await fetch("/api/repair-module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: mod, forceAi }),
      });
      const data = (await res.json()) as {
        blueprint?: ModuleBlueprint;
        changeSummary?: string;
        after?: BlueprintHealth;
        error?: string;
        aiError?: string;
      };
      if (!res.ok || !data.blueprint) {
        throw new Error(data.error || data.aiError || "Не удалось починить");
      }
      updateCustomModuleFromBlueprint(mod.id, data.blueprint);
      setNote(data.changeSummary || "Готово");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка починки";
      pushOpsError({ source: "repair", message: msg, detail: mod.title });
      setNote(msg);
    } finally {
      setBusyId(null);
      void refreshServer();
    }
  }

  async function clearServer() {
    await fetch("/api/ops-log", { method: "DELETE" });
    clearOpsErrors();
    await refreshServer();
  }

  const mergedErrors = useMemo(() => {
    const map = new Map<string, OpsErrorLog>();
    for (const e of [...opsErrors, ...serverErrors]) {
      if (!map.has(e.id)) map.set(e.id, e);
    }
    return [...map.values()].sort((a, b) => b.at.localeCompare(a.at));
  }, [opsErrors, serverErrors]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Служебное
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Админка Маи
          </h1>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-line px-3 py-2 text-xs font-medium text-muted hover:bg-accent-soft hover:text-foreground"
        >
          ← К приложению
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        Валидатор дневников, авто-починка и лог ошибок чата. Отдельная страница —
        в меню мам её нет. Открывать:{" "}
        <code className="text-foreground">/admin</code>
      </p>

      {note && (
        <p className="mt-4 rounded-xl border border-line bg-accent-soft/50 px-3 py-2 text-sm text-foreground">
          {note}
        </p>
      )}

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Свои дневники
          </h2>
          <button
            type="button"
            onClick={() => {
              const n = healCustomModulesLocally();
              setNote(
                n
                  ? `Локально подлечила: ${n}`
                  : "Битых дневников не нашлось",
              );
            }}
            className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent-soft"
          >
            Починить все локально
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          Всего своих: {customModules.length}. С замечаниями: {broken.length}.
        </p>

        {customModules.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Пока нет своих дневников.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {healthRows.map(({ mod, health }) => (
              <li
                key={mod.id}
                className="rounded-2xl border border-line bg-card/90 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{mod.title}</p>
                    <p className="text-xs text-muted">
                      {health.ok ? "Схема ок" : "Есть ошибки"} ·{" "}
                      <Link
                        href={`/m/${mod.id}`}
                        className="text-accent underline"
                      >
                        открыть
                      </Link>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === mod.id}
                      onClick={() => void repairOne(mod, false)}
                      className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-50"
                    >
                      {busyId === mod.id ? "…" : "Починить"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === mod.id}
                      onClick={() => void repairOne(mod, true)}
                      className="rounded-xl border border-line px-3 py-1.5 text-xs text-muted disabled:opacity-50"
                    >
                      Через ИИ
                    </button>
                  </div>
                </div>
                {health.issues.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {health.issues.map((i) => (
                      <li
                        key={`${i.code}-${i.message}`}
                        className={`text-xs ${
                          i.severity === "error"
                            ? "text-rose-700"
                            : "text-muted"
                        }`}
                      >
                        [{i.severity}] {i.message}
                      </li>
                    ))}
                  </ul>
                )}
                {mod.lastRepairedAt && (
                  <p className="mt-2 text-[11px] text-muted">
                    Чинили: {fmtWhen(mod.lastRepairedAt)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Ошибки чата / API
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void refreshServer()}
              className="rounded-xl border border-line px-3 py-1.5 text-xs text-muted"
            >
              Обновить
            </button>
            <button
              type="button"
              onClick={() => void clearServer()}
              className="rounded-xl border border-line px-3 py-1.5 text-xs text-muted"
            >
              Очистить
            </button>
          </div>
        </div>
        {mergedErrors.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Пока тихо — ошибок нет.</p>
        ) : (
          <ul className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto">
            {mergedErrors.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-line bg-card/80 px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {e.source}
                  </span>
                  <span className="text-[11px] text-muted">{fmtWhen(e.at)}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">{e.message}</p>
                {e.userSnippet && (
                  <p className="mt-1 text-xs text-muted">«{e.userSnippet}»</p>
                )}
                {e.status != null && (
                  <p className="mt-0.5 text-[11px] text-muted">
                    HTTP {e.status}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
