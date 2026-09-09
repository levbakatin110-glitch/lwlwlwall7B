"use client";

import type { DiaryInsightView, InsightTone, SparkPoint } from "@/lib/diary-insights";

function toneClass(tone: InsightTone): string {
  if (tone === "watch") return "border-amber-500/30 bg-amber-500/[0.08]";
  if (tone === "ok") return "border-emerald-500/25 bg-emerald-500/[0.07]";
  return "border-line bg-card/80";
}

function stacked(p: SparkPoint): boolean {
  return (p.night ?? 0) > 0 || (p.day ?? 0) > 0;
}

function SparkColumn({
  p,
  max,
  useStack,
}: {
  p: SparkPoint;
  max: number;
  useStack: boolean;
}) {
  const night = p.night ?? 0;
  const day = p.day ?? 0;
  const nightPct = night > 0 ? (night / max) * 100 : 0;
  const dayPct = day > 0 ? (day / max) * 100 : 0;
  const valuePct = p.value > 0 ? Math.max(8, (p.value / max) * 100) : 0;

  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center"
      title={
        useStack
          ? `${p.label}: ночь ${night} ч, день ${day} ч`
          : `${p.label}: ${p.value}`
      }
    >
      <div className="flex h-16 w-full flex-col justify-end">
        {useStack ? (
          <>
            <span
              className="w-full rounded-t-sm bg-accent/40"
              style={{ height: `${dayPct}%` }}
            />
            <span
              className="w-full rounded-sm bg-accent"
              style={{ height: `${nightPct}%` }}
            />
          </>
        ) : p.value > 0 ? (
          <span
            className="w-full rounded-sm bg-accent/80"
            style={{ height: `${valuePct}%` }}
          />
        ) : (
          <span className="w-full rounded-sm bg-foreground/10" style={{ height: 3 }} />
        )}
      </div>
      <span className="mt-1 w-full truncate text-center text-[9px] leading-none text-muted">
        {p.label}
      </span>
    </div>
  );
}

export function DiaryInsightCard({ view }: { view: DiaryInsightView }) {
  const { spark, sparkCaption, insight } = view;
  const visible = spark.filter((p) => p.value > 0);
  if (!insight && visible.length === 0) return null;
  const useStack = spark.some(stacked);
  const max = Math.max(
    0.001,
    ...spark.map((p) =>
      useStack ? (p.night ?? 0) + (p.day ?? 0) || p.value : p.value,
    ),
  );
  const showSpark = spark.length >= 2 && visible.length > 0;

  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${insight ? toneClass(insight.tone) : "border-line bg-card/80"}`}>
      {showSpark ? (
        <div className="mb-2.5">
          <p className="text-[10px] font-medium tracking-wide text-muted">
            {sparkCaption ?? "динамика"}
          </p>
          {useStack ? (
            <div className="mt-1.5 flex gap-3 text-[10px] text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-accent" />
                Ночной
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-accent/40" />
                Дневной
              </span>
            </div>
          ) : null}
          <div className="mt-2 flex items-end gap-1">
            {spark.map((p) => (
              <SparkColumn key={p.key} p={p} max={max} useStack={useStack} />
            ))}
          </div>
        </div>
      ) : null}
      {insight ? (
        <>
          <p className="text-sm font-semibold leading-snug">{insight.title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            {insight.detail}
          </p>
        </>
      ) : null}
    </div>
  );
}
