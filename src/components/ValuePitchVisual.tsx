"use client";

import { MayaIcon } from "@/components/icons/MayaIcon";
import { SketchMaya } from "@/components/illustrations/MayaSketch";
import type { ValuePlus } from "@/lib/value-pitch";

const ORBIT = 5;

export function ValuePitchVisual({
  hello,
  pluses,
}: {
  hello: string;
  pluses: readonly ValuePlus[];
}) {
  const chips = pluses.slice(0, ORBIT);

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="relative mx-auto h-[11.5rem] w-[11.5rem]">
        <div
          className="pointer-events-none absolute inset-[12%] rounded-full bg-accent/15 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-[22%] rounded-full border border-accent/20"
          aria-hidden
        />
        <div className="maya-orbit absolute inset-0">
          {chips.map((plus, i) => {
            const angle = (i / chips.length) * 360;
            return (
              <div
                key={plus.chip}
                className="absolute left-1/2 top-1/2 h-0 w-0"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                <div
                  className="absolute left-0 top-0"
                  style={{
                    transform: "translate(-50%, -50%) translateY(-5.15rem)",
                  }}
                >
                  <div className="maya-orbit-counter">
                    <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-accent/25 bg-card/95 px-2 py-1 text-[10px] font-semibold text-accent shadow-sm shadow-accent/10">
                      <MayaIcon name={plus.icon} size={12} />
                      {plus.chip}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="absolute left-1/2 top-1/2 flex h-[4.75rem] w-[4.75rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 shadow-[0_0_0_6px_color-mix(in_oklab,var(--accent)_16%,transparent)]">
          <SketchMaya className="h-16 w-16" />
        </div>
      </div>
      <p className="relative mx-auto mt-1 max-w-[20rem] rounded-2xl rounded-tl-md border border-accent/20 bg-card/80 px-3.5 py-2.5 text-[13px] leading-snug text-foreground/90">
        {hello}
      </p>
    </div>
  );
}
