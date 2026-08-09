"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBadge, MayaIcon } from "@/components/icons/MayaIcon";
import { OPTIONAL_MODULES, MODULE_BY_ID } from "@/lib/modules";
import { isSubscriptionActive } from "@/lib/subscription";
import { useAppStore } from "@/lib/store";
import type { ModuleBlueprint, ModuleId } from "@/lib/types";

export default function ModulesPage() {
  const router = useRouter();
  const enabledModules = useAppStore((s) => s.enabledModules);
  const customModules = useAppStore((s) => s.customModules);
  const toggleModule = useAppStore((s) => s.toggleModule);
  const enableModule = useAppStore((s) => s.enableModule);
  const addCustomModuleFromBlueprint = useAppStore((s) => s.addCustomModuleFromBlueprint);
  const removeCustomModule = useAppStore((s) => s.removeCustomModule);

  const [prompt, setPrompt] = useState("");
  const [blueprint, setBlueprint] = useState<ModuleBlueprint | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function design(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    if (!isSubscriptionActive(useAppStore.getState().subscription)) {
      setError("Создание своих дневников — в подписке.");
      router.push("/pricing");
      return;
    }
    setLoading(true);
    setError(null);
    setBlueprint(null);
    try {
      const res = await fetch("/api/design-module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: prompt.trim() }),
      });
      const data = (await res.json()) as ModuleBlueprint & { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось спроектировать");
      setBlueprint(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  function confirmCreate() {
    if (!blueprint) return;
    if (blueprint.suggestBuiltin) {
      const id = blueprint.suggestBuiltin as ModuleId;
      enableModule(id);
      setPrompt("");
      setBlueprint(null);
      setShowForm(false);
      router.push(`/m/${id}`);
      return;
    }
    const id = addCustomModuleFromBlueprint(blueprint);
    setPrompt("");
    setBlueprint(null);
    setShowForm(false);
    router.push(`/m/${id}`);
  }

  return (
    <div className="maya-page mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-display flex items-center gap-3 text-3xl font-semibold">
        <IconBadge name="memory" />
        Разделы
      </h1>
      <p className="mt-1 text-sm text-muted">Сон, кормление, рост — или свой.</p>

      <div className="mt-6">
        {!showForm ? (
          <button
            type="button"
            onClick={() => {
              if (!isSubscriptionActive(useAppStore.getState().subscription)) {
                router.push("/pricing");
                return;
              }
              setShowForm(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/40 px-4 py-4 text-sm font-medium text-accent hover:bg-accent-soft"
          >
            <MayaIcon name="spark" size={16} />
            Создать свой
          </button>
        ) : (
          <div className="maya-panel space-y-3 rounded-2xl border border-line bg-card/70 p-4">
            <p className="font-medium">Что вести?</p>
            <p className="text-xs text-muted">
              Например «развитие малыша» — будет умный блок с вехами, не только поля.
            </p>
            <form onSubmit={(e) => void design(e)} className="space-y-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Хочу отслеживать сон малыша / своё восстановление…"
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loading ? "ИИ проектирует…" : "Спроектировать"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setBlueprint(null);
                    setError(null);
                  }}
                  className="rounded-xl border border-line bg-card px-4 py-2 text-sm"
                >
                  Отмена
                </button>
              </div>
            </form>

            {error && (
              <p className="rounded-xl border border-blush/40 bg-blush-soft px-3 py-2 text-sm">
                {error}
              </p>
            )}

            {blueprint && (
              <div className="maya-panel rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
                {blueprint.suggestBuiltin ? (
                  <>
                    <p className="font-display text-xl">
                      Уже есть готовый раздел
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      «{MODULE_BY_ID[blueprint.suggestBuiltin as ModuleId]?.title ||
                        blueprint.suggestBuiltin}
                      » — с умным инструментом внутри. Не нужно создавать пустую
                      анкету.
                    </p>
                    <button
                      type="button"
                      onClick={confirmCreate}
                      className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-[var(--on-accent)]"
                    >
                      Открыть готовый
                    </button>
                  </>
                ) : (
                  <>
                    <p className="font-display flex items-center gap-3 text-xl">
                      <IconBadge name={blueprint.icon} />
                      {blueprint.title}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {blueprint.description}
                    </p>
                    {blueprint.smart && (
                      <p className="mt-2 rounded-xl bg-card/80 px-3 py-2 text-sm text-foreground">
                        Умный блок:{" "}
                        <span className="font-semibold">{blueprint.smart.title}</span>
                        <span className="text-muted">
                          {" "}
                          (
                          {blueprint.smart.kind === "milestones"
                            ? "вехи"
                            : blueprint.smart.kind === "goal"
                              ? "цель"
                              : blueprint.smart.kind === "scale"
                                ? "шкала"
                                : blueprint.smart.kind === "streak"
                                  ? "серия дней"
                                  : blueprint.smart.kind === "timer"
                                    ? "таймер"
                                    : "подсказки"}
                          )
                        </span>
                      </p>
                    )}
                    <ul className="mt-3 space-y-1 text-sm">
                      {blueprint.fields.map((f) => (
                        <li key={f.key}>
                          {f.label}{" "}
                          <span className="text-muted">({f.type})</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={confirmCreate}
                      className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-[var(--on-accent)]"
                    >
                      Создать и открыть
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {customModules.length > 0 && (
        <>
          <p className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Мои
          </p>
          <ul className="space-y-3">
            {customModules.map((mod, i) => (
              <li
                key={mod.id}
                className="maya-item flex flex-col gap-3 rounded-2xl border border-line bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <div className="flex gap-3">
                  <IconBadge name={mod.icon} />
                  <div>
                    <p className="font-medium">{mod.title}</p>
                    <p className="mt-1 text-sm text-muted">{mod.description}</p>
                    {mod.fields?.length ? (
                      <p className="mt-1 text-xs text-muted">
                        Поля: {mod.fields.map((f) => f.label).join(", ")}
                      </p>
                    ) : null}
                    <Link
                      href={`/m/${mod.id}`}
                      className="mt-2 inline-block text-sm text-accent underline"
                    >
                      Открыть
                    </Link>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Удалить дневник?")) removeCustomModule(mod.id);
                  }}
                  className="shrink-0 rounded-xl border border-line px-4 py-2 text-sm text-muted"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        Для малыша
      </p>
      <ul className="space-y-3">
        {OPTIONAL_MODULES.map((mod, i) => {
          const on = enabledModules.includes(mod.id);
          return (
            <li
              key={mod.id}
              className={`maya-item flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                on
                  ? "border-line bg-card/70"
                  : "border-line/70 bg-card/40 opacity-70"
              }`}
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <div className="flex gap-3">
                <IconBadge name={mod.icon} />
                <div>
                  <p className="font-medium">{mod.title}</p>
                  <p className="mt-1 text-sm text-muted">{mod.description}</p>
                  {on ? (
                    <Link
                      href={`/m/${mod.id}`}
                      className="mt-2 inline-block text-sm text-accent underline"
                    >
                      Открыть журнал
                    </Link>
                  ) : (
                    <p className="mt-2 text-xs text-muted">
                      Выключен — в меню слева не показывается
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleModule(mod.id)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium ${
                  on
                    ? "border border-line bg-accent-soft text-accent"
                    : "bg-accent text-white"
                }`}
              >
                {on ? "Отключить" : "Подключить"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
