"use client";

import type { DiaryInsightView, InsightTone } from "@/lib/diary-insights";

function toneClass(tone: InsightTone): string {
  if (tone === "watch") return "border-amber-500/30 bg-amber-500/[0.08]";
  if (tone === "ok") return "border-emerald-500/25 bg-emerald-500/[0.07]";
  return "border-line bg-card/80";
}

export function DiaryInsightCard({ view }: { view: DiaryInsightView }) {
  const { spark, sparkCaption, insight } = view;
  const visible = spark.filter((p) => p.value > 0);
  if (!insight && visible.length === 0) return null;
  const max = Math.max(0.001, ...spark.map((p) => p.value));

  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${insight ? toneClass(insight.tone) : "border-line bg-card/80"}`}>
      {visible.length >= 2 ? (
        <div className="mb-2.5">
          <p className="text-[10px] font-medium tracking-wide text-muted">
            {sparkCaption ?? "динамика"}
          </p>
          <div className="mt-2 flex h-14 items-end gap-1">
            {spark.map((p) => (
              <div
                key={p.key}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                <span
                  className="w-full rounded-sm bg-accent/80"
                  style={{
                    height: `${p.value > 0 ? Math.max(10, (p.value / max) * 100) : 0}%`,
                  }}
                  title={`${p.label}: ${p.value}`}
                />
              </div>
            ))}
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
