"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  validateCustomModule,
  type BlueprintHealth,
} from "@/lib/blueprint-health";
import type { OpsErrorLog } from "@/lib/ops-log";
import { useAppStore } from "@/lib/store";
import type { CustomModule, ModuleBlueprint } from "@/lib/types";

const PASS_KEY = "maya-admin-pass";

type ModerationStrike = {
  authorKey: string;
  nick: string | null;
  count: number;
  mutedUntil: number;
  kicked: boolean;
  lastReason?: string;
  updatedAt: string;
  muted: boolean;
};

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

function fmtUntil(ms: number) {
  if (ms <= Date.now()) return "истекла";
  try {
    return new Date(ms).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ms);
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

  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<OpsErrorLog[]>([]);
  const [strikes, setStrikes] = useState<ModerationStrike[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const adminHeaders = useCallback(
    (pass: string) => ({ "x-admin-password": pass }),
    [],
  );

  const tryLogin = useCallback(async (pass: string) => {
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: pass }),
      });
      if (!res.ok) {
        setAuthed(false);
        setAuthError("Неверный пароль");
        sessionStorage.removeItem(PASS_KEY);
        return false;
      }
      setAuthed(true);
      sessionStorage.setItem(PASS_KEY, pass);
      return true;
    } catch {
      setAuthError("Не удалось войти");
      return false;
    }
  }, []);

  const refreshServer = useCallback(
    async (pass: string) => {
      try {
        const [opsRes, modRes] = await Promise.all([
          fetch("/api/ops-log", { headers: adminHeaders(pass) }),
          fetch("/api/admin/moderation", { headers: adminHeaders(pass) }),
        ]);
        if (opsRes.status === 401 || modRes.status === 401) {
          setAuthed(false);
          sessionStorage.removeItem(PASS_KEY);
          return;
        }
        const data = (await opsRes.json()) as { errors?: OpsErrorLog[] };
        setServerErrors(data.errors ?? []);
        if (modRes.ok) {
          const mod = (await modRes.json()) as { strikes?: ModerationStrike[] };
          setStrikes(mod.strikes ?? []);
        }
      } catch {
        setServerErrors([]);
      }
    },
    [adminHeaders],
  );

  useEffect(() => {
    const saved = sessionStorage.getItem(PASS_KEY);
    if (saved) {
      setPassword(saved);
      void tryLogin(saved).then((ok) => {
        if (ok) void refreshServer(saved);
      });
    }
  }, [refreshServer, tryLogin]);

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

  async function repairOne(mod: CustomModule, forceAi = false) {
    const pass = sessionStorage.getItem(PASS_KEY) || password;
    setBusyId(mod.id);
    setNote(null);
    try {
      const res = await fetch("/api/repair-module", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(pass ? { "x-admin-password": pass } : {}),
        },
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
      const pass = sessionStorage.getItem(PASS_KEY) || password;
      if (pass) void refreshServer(pass);
    }
  }

  async function clearServer() {
    const pass = sessionStorage.getItem(PASS_KEY) || password;
    if (!pass) return;
    await fetch("/api/ops-log", {
      method: "DELETE",
      headers: adminHeaders(pass),
    });
    clearOpsErrors();
    await refreshServer(pass);
  }

  async function deleteVoiceNotes() {
    const pass = sessionStorage.getItem(PASS_KEY) || password;
    if (!pass) return;
    if (!confirm("Удалить все голосовые из круга мам? Кружки и фото останутся.")) {
      return;
    }
    setBusyId("voice");
    setNote(null);
    try {
      const res = await fetch("/api/admin/community?kind=voice", {
        method: "DELETE",
        headers: adminHeaders(pass),
      });
      const data = (await res.json()) as { error?: string; deleted?: number };
      if (!res.ok) throw new Error(data.error || "Не удалилось");
      setNote(`Голосовых удалено: ${data.deleted ?? 0}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  async function clearStrike(authorKey: string) {
    const pass = sessionStorage.getItem(PASS_KEY) || password;
    if (!pass) return;
    setBusyId(authorKey);
    setNote(null);
    try {
      const res = await fetch(
        `/api/admin/moderation?authorKey=${encodeURIComponent(authorKey)}`,
        { method: "DELETE", headers: adminHeaders(pass) },
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Не снялось");
      }
      setNote("Мут/кик снят");
      await refreshServer(pass);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  const mergedErrors = useMemo(() => {
    const map = new Map<string, OpsErrorLog>();
    for (const e of [...opsErrors, ...serverErrors]) {
      if (!map.has(e.id)) map.set(e.id, e);
    }
    return [...map.values()].sort((a, b) => b.at.localeCompare(a.at));
  }, [opsErrors, serverErrors]);

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
        <h1 className="font-display text-2xl font-semibold">Админка</h1>
        <p className="mt-2 text-sm text-muted">
          Пароль из{" "}
          <code className="text-foreground">ADMIN_PASSWORD</code> на сервере
          (или <code className="text-foreground">ANALYTICS_PASSWORD</code>).
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void tryLogin(password).then((ok) => {
              if (ok) void refreshServer(password);
            });
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
            autoComplete="current-password"
          />
          {authError && (
            <p className="text-sm text-rose-700">{authError}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
          >
            Войти
          </button>
        </form>
        <Link href="/" className="mt-6 text-center text-sm text-muted underline">
          ← К приложению
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-20">
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
        в меню мам её нет.{" "}
        <Link href="/admin/stats" className="text-accent underline">
          Аналитика
        </Link>
      </p>

      <div className="mt-6 rounded-2xl border border-line bg-card/60 p-5 text-sm text-muted">
        <p className="font-medium text-foreground">Чаты консультанта</p>
        <p className="mt-1.5 leading-relaxed">
          Отключены. В продаже только Maya Premium.
        </p>
      </div>

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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Круг мам — муты и кики
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busyId === "voice"}
              onClick={() => void deleteVoiceNotes()}
              className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs text-rose-700"
            >
              {busyId === "voice" ? "…" : "Удалить голосовые"}
            </button>
          <button
            type="button"
            onClick={() => {
              const pass = sessionStorage.getItem(PASS_KEY) || password;
              if (pass) void refreshServer(pass);
            }}
            className="rounded-xl border border-line px-3 py-1.5 text-xs text-muted"
          >
            Обновить
          </button>
          </div>
        </div>
        {strikes.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Никого не глушили и не кикали.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {strikes.map((s) => (
              <li
                key={s.authorKey}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card/80 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {s.nick || "без ника"}{" "}
                    <span className="font-normal text-muted">
                      · {s.authorKey.slice(0, 8)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {s.kicked
                      ? "кик"
                      : s.muted
                        ? `мут до ${fmtUntil(s.mutedUntil)}`
                        : "страйки без активного мута"}
                    {" · "}
                    страйков: {s.count}
                    {s.lastReason ? ` · ${s.lastReason}` : ""}
                    {" · "}
                    {fmtWhen(s.updatedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === s.authorKey}
                  onClick={() => void clearStrike(s.authorKey)}
                  className="rounded-xl border border-line px-3 py-1.5 text-xs text-accent disabled:opacity-50"
                >
                  {busyId === s.authorKey ? "…" : "Снять"}
                </button>
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
              onClick={() => {
                const pass = sessionStorage.getItem(PASS_KEY) || password;
                if (pass) void refreshServer(pass);
              }}
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
