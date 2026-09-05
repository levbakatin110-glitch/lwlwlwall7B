"use client";

import { MayaIcon } from "@/components/icons/MayaIcon";
import { SketchMaya } from "@/components/illustrations/MayaSketch";
import type { ValuePlus } from "@/lib/value-pitch";

export function ValuePitchVisual({
  hello,
  pluses,
}: {
  hello: string;
  pluses: readonly ValuePlus[];
}) {
  const chips = pluses.slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="relative mx-auto h-[14.25rem] w-[14.25rem]">
        <div
          className="pointer-events-none absolute inset-[16%] rounded-full bg-accent/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-[10%] rounded-full border border-dashed border-accent/30"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-[26%] rounded-full border border-accent/15"
          aria-hidden
        />
        {chips.map((plus, i) => {
          const deg = -90 + (i / chips.length) * 360;
          const rad = (deg * Math.PI) / 180;
          const x = Math.cos(rad) * 5.85;
          const y = Math.sin(rad) * 5.85;
          return (
            <div
              key={plus.chip}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(calc(-50% + ${x}rem), calc(-50% + ${y}rem))`,
              }}
            >
              <span
                className="maya-float flex items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/20 bg-card px-2.5 py-1 text-[11px] font-semibold tracking-wide text-accent shadow-[0_6px_16px_-8px_color-mix(in_oklab,var(--accent)_55%,transparent)]"
                style={{ animationDelay: `${i * 0.35}s` }}
              >
                <MayaIcon name={plus.icon} size={13} />
                {plus.chip}
              </span>
            </div>
          );
        })}
        <div className="absolute left-1/2 top-1/2 flex h-[5.25rem] w-[5.25rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-[0_0_0_7px_color-mix(in_oklab,var(--accent)_18%,transparent),0_0_0_14px_color-mix(in_oklab,var(--accent)_8%,transparent)]">
          <SketchMaya className="h-[4.25rem] w-[4.25rem]" />
        </div>
      </div>
      <p className="relative mx-auto mt-2 max-w-[20rem] rounded-2xl rounded-tl-md border border-accent/15 bg-card/90 px-3.5 py-2.5 text-[13px] leading-snug text-foreground/90">
        <span
          className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 border-l border-t border-accent/15 bg-card/90"
          aria-hidden
        />
        {hello}
      </p>
    </div>
  );
}
