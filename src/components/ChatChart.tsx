"use client";

import { MayaIcon } from "@/components/icons/MayaIcon";
import { useMemo } from "react";
import { useAppStore } from "@/lib/store";

export function ChatChart({
  moduleId,
  fieldKey,
  months = 6,
}: {
  moduleId: string;
  fieldKey: string;
  months?: number;
}) {
  const module = useAppStore((s) => s.customModules.find((m) => m.id === moduleId));
  const entries = useAppStore((s) => s.journals[moduleId] ?? []);

  const series = useMemo(() => {
    const from = new Date();
    from.setMonth(from.getMonth() - months);
    const fromStr = from.toISOString().slice(0, 10);
    return entries
      .filter((e) => e.date >= fromStr)
      .map((e) => ({
        date: e.date,
        value: Number(e.fields?.[fieldKey]),
      }))
      .filter((p) => Number.isFinite(p.value))
      .reverse();
  }, [entries, fieldKey, months]);

  const fieldLabel =
    module?.fields?.find((f) => f.key === fieldKey)?.label || fieldKey;

  if (!module) {
    return (
      <p className="mt-2 text-xs text-muted">Раздел для графика не найден.</p>
    );
  }

  if (series.length < 2) {
    return (
      <div className="maya-msg-in mt-3 rounded-xl bg-accent-soft/60 p-3 text-sm text-foreground">
        <p className="flex items-center gap-2 font-medium">
          <MayaIcon name={module.icon} size={16} />
          {module.title} — {fieldLabel}
        </p>
        <p className="mt-1 text-xs text-muted">
          Пока мало точек для графика (нужно хотя бы 2 записи с числом).
        </p>
      </div>
    );
  }

  const values = series.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 280;
  const h = 90;
  const pts = series
    .map((s, i) => {
      const x = (i / (series.length - 1)) * (w - 12) + 6;
      const y = h - 10 - ((s.value - min) / span) * (h - 20);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="maya-msg-in mt-3 rounded-xl bg-accent-soft/70 p-3 text-foreground">
      <p className="flex items-center gap-2 text-xs text-muted">
        <MayaIcon name={module.icon} size={14} />
        {module.title} · {fieldLabel} · {months} мес.
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-24 w-full max-w-sm">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-accent"
          points={pts}
        />
      </svg>
      <p className="text-xs text-muted">
        {series[0].date}: {series[0].value} → {series[series.length - 1].date}:{" "}
        {series[series.length - 1].value}
      </p>
    </div>
  );
}
