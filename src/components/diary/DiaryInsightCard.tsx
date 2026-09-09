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
          <div className="mt-2 flex h-16 items-end gap-1">
            {spark.map((p) => {
              const night = p.night ?? 0;
              const day = p.day ?? 0;
              const nightPct = night > 0 ? (night / max) * 100 : 0;
              const dayPct = day > 0 ? (day / max) * 100 : 0;
              return (
                <div
                  key={p.key}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                  title={
                    useStack
                      ? `${p.label}: ночь ${night} ч, день ${day} ч`
                      : `${p.label}: ${p.value}`
                  }
                >
                  {useStack ? (
                    <>
                      <span
                        className="w-full rounded-t-sm bg-accent/40"
                        style={{ height: `${dayPct}%` }}
                      />
                      <span
                        className="w-full bg-accent"
                        style={{ height: `${nightPct}%` }}
                      />
                    </>
                  ) : (
                    <span
                      className="w-full rounded-sm bg-accent/80"
                      style={{
                        height: `${p.value > 0 ? Math.max(10, (p.value / max) * 100) : 0}%`,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-muted">
            <span>{spark[0]?.label}</span>
            <span>{spark[spark.length - 1]?.label}</span>
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
