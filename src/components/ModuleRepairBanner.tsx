"use client";

import { useMemo, useState } from "react";
import {
  validateCustomModule,
  type BlueprintHealth,
} from "@/lib/blueprint-health";
import { useAppStore } from "@/lib/store";
import type { CustomModule, ModuleBlueprint } from "@/lib/types";

/** Баннер на странице своего дневника, если схема кривая */
export function ModuleRepairBanner({ mod }: { mod: CustomModule }) {
  const updateCustomModuleFromBlueprint = useAppStore(
    (s) => s.updateCustomModuleFromBlueprint,
  );
  const pushOpsError = useAppStore((s) => s.pushOpsError);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const health = useMemo(() => validateCustomModule(mod), [mod]);

  if (health.ok && health.issues.length === 0) return null;

  async function repair() {
    setBusy(true);
    setDone(null);
    try {
      const res = await fetch("/api/repair-module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: mod }),
      });
      const data = (await res.json()) as {
        blueprint?: ModuleBlueprint;
        changeSummary?: string;
        after?: BlueprintHealth;
        error?: string;
      };
      if (!res.ok || !data.blueprint) {
        throw new Error(data.error || "Не удалось починить");
      }
      updateCustomModuleFromBlueprint(mod.id, data.blueprint);
      setDone(data.changeSummary || "Починила");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      pushOpsError({ source: "repair", message: msg, detail: mod.title });
      setDone(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="maya-rise mt-4 rounded-2xl border border-blush/50 bg-blush-soft/80 px-4 py-3">
      <p className="text-sm font-semibold text-foreground">
        Дневник выглядит криво
      </p>
      <ul className="mt-1 space-y-0.5">
        {health.issues.slice(0, 4).map((i) => (
          <li key={i.code + i.message} className="text-xs text-muted">
            · {i.message}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={busy}
        onClick={() => void repair()}
        className="mt-3 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-50"
      >
        {busy ? "Чиню…" : "Починить автоматически"}
      </button>
      {done && <p className="mt-2 text-xs text-muted">{done}</p>}
    </div>
  );
}
