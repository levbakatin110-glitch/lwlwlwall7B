"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import {
  DiaryChip,
  DiaryEmpty,
  DiaryPage,
  DiaryPrimaryButton,
  DiarySectionTitle,
  DiaryStats,
  DiaryStickyCta,
  DiaryTimeline,
  DiaryTimelineRow,
} from "@/components/diary/DiaryShell";
import {
  entriesForToday,
  entryTimeMs,
  formatClock,
  todayYmd,
} from "@/lib/diary-day";

const PRESETS = [30, 60, 90, 120, 150, 180, 210, 240] as const;
const MAX_ML = 260;
const BRAND_KEY = "maya-formula-brand";

const BRANDS = ["Nutrilon", "NAN", "Similac", "Kabrita", "своя"] as const;

export function BottleTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => s.journals.formula ?? []);

  const [ml, setMl] = useState(120);
  const [brand, setBrand] = useState<string>("");
  const [customBrand, setCustomBrand] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BRAND_KEY);
      if (saved) {
        if (BRANDS.includes(saved as (typeof BRANDS)[number])) {
          setBrand(saved);
        } else {
          setBrand("своя");
          setCustomBrand(saved);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const label =
      brand === "своя"
        ? customBrand.trim()
        : brand;
    if (!label) return;
    try {
      localStorage.setItem(BRAND_KEY, label);
    } catch {
      /* ignore */
    }
  }, [brand, customBrand]);

  const fill = Math.min(1, Math.max(0, ml / MAX_ML));
  const liquidY = 18 + (1 - fill) * 70;

  const todayEntries = useMemo(
    () =>
      [...entriesForToday(entries)].sort(
        (a, b) => entryTimeMs(b) - entryTimeMs(a),
      ),
    [entries],
  );

  const stats = useMemo(() => {
    let totalMl = 0;
    for (const e of todayEntries) {
      const fromField = Number(e.fields?.ml);
      if (Number.isFinite(fromField)) totalMl += fromField;
      else {
        const m = e.value.match(/(\d+)\s*мл/i);
        if (m) totalMl += Number(m[1]);
      }
    }
    const last = todayEntries[0];
    const lastMl = last
      ? Number(last.fields?.ml) ||
        Number(last.value.match(/(\d+)/)?.[1]) ||
        0
      : 0;
    return {
      totalMl,
      count: todayEntries.length,
      lastMl: lastMl > 0 ? `${lastMl} мл` : "—",
    };
  }, [todayEntries]);

  function save() {
    if (ml < 10) return;
    const brandLabel =
      brand === "своя" ? customBrand.trim() || "своя смесь" : brand;
    const value = brandLabel ? `${ml} мл · ${brandLabel}` : `${ml} мл`;
    addJournalEntry("formula", {
      date: todayYmd(),
      value,
      note: "",
      fields: {
        ml,
        brand: brandLabel || "",
        startMs: Date.now(),
      },
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <DiaryPage stickyPad>
      <DiaryStats
        items={[
          { label: "порция", value: `${ml} мл` },
          { label: "сегодня", value: stats.totalMl },
          { label: "кормлений", value: stats.count },
        ]}
      />

      <div className="flex items-end justify-center gap-6">
          <svg
            viewBox="0 0 80 120"
            className="h-40 w-28 drop-shadow-sm"
            aria-hidden
          >
            <path
              d="M34 8h12v10c0 3-2 5-6 5s-6-2-6-5V8Z"
              className="fill-foreground/25"
            />
            <rect
              x="30"
              y="18"
              width="20"
              height="8"
              rx="2"
              className="fill-foreground/20"
            />
            <path
              d="M22 28h36c3 0 6 3 6 6v70c0 6-5 10-11 10H27c-6 0-11-4-11-10V34c0-3 3-6 6-6Z"
              className="fill-background stroke-line"
              strokeWidth="1.5"
            />
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
                <DiaryChip
                  key={p}
                  active={ml === p}
                  onClick={() => setMl(p)}
                >
                  {p}
                </DiaryChip>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[11px] text-muted">Марка (по желанию)</p>
          <div className="flex flex-wrap gap-1.5">
            {BRANDS.map((b) => (
              <DiaryChip
                key={b}
                active={brand === b}
                onClick={() => setBrand(brand === b ? "" : b)}
              >
                {b}
              </DiaryChip>
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

        {todayEntries.length > 0 ? (
          <div className="mt-6">
            <DiarySectionTitle
              left="Сегодня"
              right={String(todayEntries.length)}
            />
            <DiaryTimeline>
              {todayEntries.map((e, i) => {
                const entryMl =
                  Number(e.fields?.ml) ||
                  Number(e.value.match(/(\d+)/)?.[1]) ||
                  0;
                const entryBrand = String(e.fields?.brand || "");
                return (
                  <li key={e.id}>
                    <DiaryTimelineRow
                      mark={entryMl || "·"}
                      accent={i === 0}
                      onClick={() => {
                        if (
                          window.confirm("Удалить эту запись из дневника?")
                        ) {
                          removeJournalEntry("formula", e.id);
                        }
                      }}
                      left={
                        <div>
                          <p className="text-sm font-medium tabular-nums">
                            {entryMl} мл
                          </p>
                          <p className="text-[10px] tabular-nums text-muted/70">
                            {formatClock(entryTimeMs(e))}
                          </p>
                        </div>
                      }
                      right={
                        entryBrand ? (
                          <p className="text-sm text-muted">{entryBrand}</p>
                        ) : (
                          <p className="text-sm text-muted/40">—</p>
                        )
                      }
                    />
                  </li>
                );
              })}
            </DiaryTimeline>
          </div>
        ) : (
          <DiaryEmpty>Сегодня ещё не записано</DiaryEmpty>
        )}

      <DiaryStickyCta>
        <DiaryPrimaryButton onClick={save} disabled={ml < 10}>
          {saved ? `✓ ${ml} мл` : `Записать ${ml} мл`}
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
