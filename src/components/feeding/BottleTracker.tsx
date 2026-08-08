"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";

const PRESETS = [30, 60, 90, 120, 150, 180, 210, 240] as const;
const MAX_ML = 260;

const BRANDS = ["Nutrilon", "NAN", "Similac", "Kabrita", "своя"] as const;

export function BottleTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const entries = useAppStore((s) => s.journals.formula ?? []);
  const [ml, setMl] = useState(120);
  const [brand, setBrand] = useState<string>("");
  const [customBrand, setCustomBrand] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const fill = Math.min(1, Math.max(0, ml / MAX_ML));
  const liquidY = 18 + (1 - fill) * 70;

  const todayMl = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return entries
      .filter((e) => e.date === today)
      .reduce((sum, e) => {
        const fromField = Number(e.fields?.ml);
        if (Number.isFinite(fromField)) return sum + fromField;
        const m = e.value.match(/(\d+)\s*мл/i);
        return sum + (m ? Number(m[1]) : 0);
      }, 0);
  }, [entries]);

  function save() {
    if (ml < 10) return;
    const brandLabel =
      brand === "своя" ? customBrand.trim() || "своя смесь" : brand;
    const value = brandLabel ? `${ml} мл · ${brandLabel}` : `${ml} мл`;
    addJournalEntry("formula", {
      date: new Date().toISOString().slice(0, 10),
      value,
      note: "",
      fields: {
        ml,
        brand: brandLabel || "",
      },
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  }

  return (
    <div className="maya-rise overflow-hidden rounded-[1.5rem] border border-line bg-card/80 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Сколько налили?
          </h2>
          <p className="mt-1 text-xs text-muted">
            Сегодня уже ~{todayMl} мл
          </p>
        </div>
        <p className="font-display text-3xl font-semibold tabular-nums text-foreground">
          {ml}
          <span className="ml-1 text-base font-medium text-muted">мл</span>
        </p>
      </div>

      <div className="mt-4 flex items-end justify-center gap-6">
        <svg
          viewBox="0 0 80 120"
          className="h-40 w-28 drop-shadow-sm"
          aria-hidden
        >
          {/* nipple */}
          <path
            d="M34 8h12v10c0 3-2 5-6 5s-6-2-6-5V8Z"
            className="fill-foreground/25"
          />
          <rect x="30" y="18" width="20" height="8" rx="2" className="fill-foreground/20" />
          {/* bottle body */}
          <path
            d="M22 28h36c3 0 6 3 6 6v70c0 6-5 10-11 10H27c-6 0-11-4-11-10V34c0-3 3-6 6-6Z"
            className="fill-background stroke-line"
            strokeWidth="1.5"
          />
          {/* liquid */}
          <defs>
            <clipPath id="bottle-clip">
              <path d="M24 30h32c2 0 4 2 4 4v68c0 4-3 8-8 8H28c-5 0-8-4-8-8V34c0-2 2-4 4-4Z" />
            </clipPath>
          </defs>
          <g clipPath="url(#bottle-clip)">
            <rect
              x="16"
              y={liquidY}
              width="48"
              height={120 - liquidY}
              className="fill-accent/55"
            />
            <ellipse
              cx="40"
              cy={liquidY}
              rx="20"
              ry="3"
              className="fill-accent/80"
            />
          </g>
          {/* marks */}
          {[60, 120, 180, 240].map((mark) => {
            const y = 28 + (1 - mark / MAX_ML) * 78;
            return (
              <g key={mark}>
                <line
                  x1="52"
                  x2="60"
                  y1={y}
                  y2={y}
                  className="stroke-muted"
                  strokeWidth="1"
                />
                <text
                  x="62"
                  y={y + 3}
                  className="fill-muted"
                  style={{ fontSize: 7 }}
                >
                  {mark}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="min-w-0 flex-1 pb-2">
          <input
            type="range"
            min={20}
            max={MAX_ML}
            step={5}
            value={ml}
            onChange={(e) => setMl(Number(e.target.value))}
            className="maya-noise-range w-full"
            aria-label="Миллилитры"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setMl(p)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  ml === p
                    ? "bg-accent text-[#ffffff]"
                    : "border border-line bg-background/50 text-muted hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[11px] text-muted">Марка (по желанию)</p>
        <div className="flex flex-wrap gap-1.5">
          {BRANDS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrand(brand === b ? "" : b)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                brand === b
                  ? "bg-accent-soft text-accent ring-1 ring-accent/30"
                  : "border border-line text-muted hover:text-foreground"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
        {brand === "своя" && (
          <input
            value={customBrand}
            onChange={(e) => setCustomBrand(e.target.value)}
            placeholder="Название смеси"
            className="mt-2 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm"
          />
        )}
      </div>

      <button
        type="button"
        onClick={save}
        className="mt-4 w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff]"
      >
        Записать {ml} мл
      </button>
      {savedFlash && (
        <p className="maya-msg-in mt-3 text-sm font-medium text-accent">
          Записано · сегодня суммарно ~{todayMl + ml} мл
        </p>
      )}
    </div>
  );
}
