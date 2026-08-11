"use client";

import {
  ageMonthsAt,
  estimateWhoPercentile,
  whoBands,
  type WhoMetric,
} from "@/lib/who-growth";
import type { Sex } from "@/lib/types";

type Point = { at: string; y: number };

export function WhoGrowthChart({
  metric,
  sex,
  birthDate,
  series,
}: {
  metric: WhoMetric;
  sex: Sex;
  birthDate?: string | null;
  series: Point[];
}) {
  const bands = whoBands(sex, metric);
  const unit = metric === "weight" ? "кг" : "см";
  const title = metric === "weight" ? "Вес и ВОЗ" : "Рост и ВОЗ";

  const childPts = series
    .map((s) => {
      const age = ageMonthsAt(birthDate, s.at);
      if (age == null || age > 26) return null;
      return { age: Math.min(24, age), y: s.y, at: s.at };
    })
    .filter(Boolean) as { age: number; y: number; at: string }[];

  const last = childPts[childPts.length - 1];
  const hint = last
    ? estimateWhoPercentile({
        sex,
        metric,
        months: last.age,
        value: last.y,
      })
    : null;

  const w = 340;
  const h = 160;
  const padL = 28;
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const xMax = 24;
  const ys = [
    ...bands.flatMap((b) => [b.p3, b.p97]),
    ...childPts.map((p) => p.y),
  ];
  const yMin = Math.min(...ys) * 0.92;
  const yMax = Math.max(...ys) * 1.05;
  const ySpan = yMax - yMin || 1;

  const xScale = (m: number) => padL + (m / xMax) * (w - padL - padR);
  const yScale = (v: number) => padT + (1 - (v - yMin) / ySpan) * (h - padT - padB);

  const linePath = (key: keyof (typeof bands)[0]) =>
    bands
      .map((b, i) => `${i === 0 ? "M" : "L"}${xScale(b.m)},${yScale(b[key])}`)
      .join(" ");

  const bandFill = (() => {
    const top = bands.map((b) => `${xScale(b.m)},${yScale(b.p85)}`).join(" L");
    const bot = [...bands]
      .reverse()
      .map((b) => `${xScale(b.m)},${yScale(b.p15)}`)
      .join(" L");
    return `M${top} L${bot} Z`;
  })();

  const sexNote =
    sex === "girl" ? "девочки" : sex === "boy" ? "мальчики" : "мальчики*";

  return (
    <div className="rounded-2xl border border-line bg-card/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            {title}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Кривые ВОЗ · {sexNote}
            {sex === "unknown" ? " (пол не указан)" : ""}
          </p>
        </div>
        {last && (
          <p className="font-display text-right text-xl font-semibold tracking-tight">
            {Number(last.y.toFixed(2))} {unit}
          </p>
        )}
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-40 w-full" aria-hidden>
        <path d={bandFill} className="fill-accent/15" />
        <path
          d={linePath("p50")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          className="text-muted"
        />
        <path
          d={linePath("p3")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-muted/50"
        />
        <path
          d={linePath("p97")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-muted/50"
        />
        {childPts.length >= 2 && (
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
            points={childPts
              .map((p) => `${xScale(p.age)},${yScale(p.y)}`)
              .join(" ")}
          />
        )}
        {childPts.map((p, i) => (
          <circle
            key={`${p.at}-${i}`}
            cx={xScale(p.age)}
            cy={yScale(p.y)}
            r="3.5"
            className="fill-accent-hot"
          />
        ))}
        <text x={padL} y={h - 6} className="fill-muted text-[9px]">
          0 мес
        </text>
        <text x={w - 36} y={h - 6} className="fill-muted text-[9px]">
          24 мес
        </text>
      </svg>

      {hint && last && (
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
          <span className="font-semibold">{hint.label}</span>
          {" — "}
          {hint.detail}
        </p>
      )}
      {!birthDate && (
        <p className="mt-2 text-xs text-muted">
          Укажите дату рождения в профиле — точки встанут на возраст.
        </p>
      )}
      {birthDate && childPts.length === 0 && (
        <p className="mt-2 text-xs text-muted">
          Добавьте абсолютный вес/рост (не только «+100 г») — появится точка на
          графике.
        </p>
      )}
    </div>
  );
}
