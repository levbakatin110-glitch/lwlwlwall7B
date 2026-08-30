"use client";

import { useMemo, useState } from "react";
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

type FoodCat = "овощи" | "фрукты" | "каши" | "белок" | "другое";

const FOODS: { name: string; cat: FoodCat }[] = [
  { name: "кабачок", cat: "овощи" },
  { name: "цветная капуста", cat: "овощи" },
  { name: "брокколи", cat: "овощи" },
  { name: "тыква", cat: "овощи" },
  { name: "морковь", cat: "овощи" },
  { name: "картофель", cat: "овощи" },
  { name: "свёкла", cat: "овощи" },
  { name: "шпинат", cat: "овощи" },
  { name: "кабачок с яблоком", cat: "овощи" },
  { name: "яблоко", cat: "фрукты" },
  { name: "груша", cat: "фрукты" },
  { name: "банан", cat: "фрукты" },
  { name: "персик", cat: "фрукты" },
  { name: "абрикос", cat: "фрукты" },
  { name: "слива", cat: "фрукты" },
  { name: "черника", cat: "фрукты" },
  { name: "манго", cat: "фрукты" },
  { name: "каша рисовая", cat: "каши" },
  { name: "каша гречневая", cat: "каши" },
  { name: "каша овсяная", cat: "каши" },
  { name: "каша кукурузная", cat: "каши" },
  { name: "каша безмолочная", cat: "каши" },
  { name: "творог", cat: "белок" },
  { name: "куриное пюре", cat: "белок" },
  { name: "индейка", cat: "белок" },
  { name: "говядина", cat: "белок" },
  { name: "рыба", cat: "белок" },
  { name: "яйцо", cat: "белок" },
  { name: "йогурт детский", cat: "белок" },
  { name: "кефир", cat: "белок" },
];

const CATEGORIES: { id: FoodCat | "все"; label: string }[] = [
  { id: "все", label: "все" },
  { id: "овощи", label: "овощи" },
  { id: "фрукты", label: "фрукты" },
  { id: "каши", label: "каши" },
  { id: "белок", label: "белок" },
  { id: "другое", label: "другое" },
];

const PORTIONS = [
  { id: "taste", label: "на кончике", value: "пробование" },
  { id: "1tsp", label: "1 ч.л.", value: "1 ч.л." },
  { id: "2tsp", label: "2 ч.л.", value: "2 ч.л." },
  { id: "3tsp", label: "3 ч.л.", value: "3 ч.л." },
  { id: "half", label: "½ банки", value: "½ порции" },
  { id: "full", label: "баночка", value: "целая порция" },
] as const;

const REACTIONS = [
  { id: "ok", label: "ок" },
  { id: "liked", label: "нравится" },
  { id: "refused", label: "отказался" },
  { id: "rash", label: "сыпь / реакция" },
] as const;

function reactionLabel(id: string): string {
  return REACTIONS.find((r) => r.id === id)?.label ?? id;
}

export function SolidsTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const removeJournalEntry = useAppStore((s) => s.removeJournalEntry);
  const entries = useAppStore((s) => s.journals.solids ?? []);

  const [catFilter, setCatFilter] = useState<FoodCat | "все">("все");
  const [food, setFood] = useState("");
  const [custom, setCustom] = useState("");
  const [portion, setPortion] = useState<string>("1tsp");
  const [reaction, setReaction] = useState<string>("ok");
  const [saved, setSaved] = useState(false);

  const foodLabel = food === "__custom" ? custom.trim() : food;

  const allFoodsEver = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      const f = String(e.fields?.food || "").trim().toLowerCase();
      if (f) set.add(f);
    }
    return set;
  }, [entries]);

  const isFirstTime =
    !!foodLabel && !allFoodsEver.has(foodLabel.trim().toLowerCase());

  const recentFoods = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const sorted = [...entries].sort(
      (a, b) => entryTimeMs(b) - entryTimeMs(a),
    );
    for (const e of sorted) {
      const f = String(e.fields?.food || "").trim();
      if (!f) continue;
      const key = f.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
      if (out.length >= 5) break;
    }
    return out;
  }, [entries]);

  const todayEntries = useMemo(
    () =>
      [...entriesForToday(entries)].sort(
        (a, b) => entryTimeMs(b) - entryTimeMs(a),
      ),
    [entries],
  );

  const stats = useMemo(() => {
    const todayFoods = new Set<string>();
    for (const e of todayEntries) {
      const f = String(e.fields?.food || "").trim();
      if (f) todayFoods.add(f.toLowerCase());
    }
    const rashCount = entries.filter(
      (e) => String(e.fields?.reaction || "") === "rash",
    ).length;
    return {
      todayCount: todayFoods.size,
      uniqueAll: allFoodsEver.size,
      rashCount,
    };
  }, [todayEntries, entries, allFoodsEver]);

  const filteredFoods = useMemo(() => {
    if (catFilter === "все") return FOODS;
    if (catFilter === "другое") return [];
    return FOODS.filter((f) => f.cat === catFilter);
  }, [catFilter]);

  function save() {
    if (!foodLabel) return;
    const portionLabel =
      PORTIONS.find((p) => p.id === portion)?.value || portion;
    const reactionLbl = reactionLabel(reaction);
    addJournalEntry("solids", {
      date: todayYmd(),
      value: `${foodLabel} · ${portionLabel}`,
      note: reactionLbl,
      fields: {
        food: foodLabel,
        portion: portionLabel,
        reaction,
        startMs: Date.now(),
      },
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  function pickFood(f: string) {
    setFood(f);
    setCustom("");
  }

  return (
    <DiaryPage stickyPad>
      <div className="maya-rise overflow-hidden rounded-[1.5rem] border border-line bg-card/80 p-4 sm:p-5">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Что пробовали?
        </h2>

        <div className="mt-4">
          <DiaryStats
            items={[
              { label: "продуктов сегодня", value: stats.todayCount },
              { label: "уникальных за всё время", value: stats.uniqueAll },
              {
                label: "реакций / сыпей",
                value: stats.rashCount,
              },
            ]}
          />
        </div>

        {recentFoods.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] text-muted">Недавние</p>
            <div className="flex flex-wrap gap-1.5">
              {recentFoods.map((f) => (
                <DiaryChip key={f} active={food === f} onClick={() => pickFood(f)}>
                  {f}
                </DiaryChip>
              ))}
            </div>
          </div>
        )}

        <p className="mb-1.5 mt-5 text-[11px] text-muted">Категория</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <DiaryChip
              key={c.id}
              active={catFilter === c.id}
              onClick={() => setCatFilter(c.id)}
            >
              {c.label}
            </DiaryChip>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {filteredFoods.map((f) => (
            <button
              key={f.name}
              type="button"
              onClick={() => pickFood(f.name)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                food === f.name
                  ? "bg-accent text-[var(--on-accent,#fff)]"
                  : "border border-line text-muted hover:text-foreground"
              }`}
            >
              {f.name}
            </button>
          ))}
          {(catFilter === "все" || catFilter === "другое") && (
            <button
              type="button"
              onClick={() => setFood("__custom")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                food === "__custom"
                  ? "bg-accent text-[var(--on-accent,#fff)]"
                  : "border border-dashed border-accent/40 text-accent"
              }`}
            >
              другое…
            </button>
          )}
        </div>

        {food === "__custom" && (
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Название продукта"
            className="mt-3 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
            autoFocus
          />
        )}

        {isFirstTime && foodLabel && (
          <p className="mt-2 inline-flex rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent">
            Впервые
          </p>
        )}

        <p className="mb-1.5 mt-5 text-[11px] text-muted">Сколько</p>
        <div className="flex flex-wrap gap-1.5">
          {PORTIONS.map((p) => (
            <DiaryChip
              key={p.id}
              active={portion === p.id}
              onClick={() => setPortion(p.id)}
            >
              {p.label}
            </DiaryChip>
          ))}
        </div>

        <p className="mb-1.5 mt-5 text-[11px] text-muted">Реакция</p>
        <div className="flex flex-wrap gap-1.5">
          {REACTIONS.map((r) => (
            <DiaryChip
              key={r.id}
              active={reaction === r.id}
              tone={
                r.id === "rash"
                  ? "hot"
                  : r.id === "refused"
                    ? "warn"
                    : "default"
              }
              onClick={() => setReaction(r.id)}
            >
              {r.label}
            </DiaryChip>
          ))}
        </div>

        {todayEntries.length > 0 ? (
          <div className="mt-6">
            <DiarySectionTitle left="Сегодня" right={String(todayEntries.length)} />
            <DiaryTimeline>
              {todayEntries.map((e, i) => {
                const f = String(e.fields?.food || e.value.split(" · ")[0] || "");
                const p = String(e.fields?.portion || "");
                const r = String(e.fields?.reaction || "");
                const rLbl = reactionLabel(r);
                const isHot = r === "rash";
                return (
                  <li key={e.id}>
                    <DiaryTimelineRow
                      mark={todayEntries.length - i}
                      accent={i === 0}
                      onClick={() => {
                        if (
                          window.confirm("Удалить эту запись из дневника?")
                        ) {
                          removeJournalEntry("solids", e.id);
                        }
                      }}
                      left={
                        <div>
                          <p className="text-sm font-medium capitalize">{f}</p>
                          {p ? (
                            <p className="text-[11px] text-muted">{p}</p>
                          ) : null}
                          <p className="text-[10px] tabular-nums text-muted/70">
                            {formatClock(entryTimeMs(e))}
                          </p>
                        </div>
                      }
                      right={
                        <p
                          className={`text-sm font-medium ${
                            isHot
                              ? "text-blush"
                              : r === "refused"
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-muted"
                          }`}
                        >
                          {rLbl}
                        </p>
                      }
                    />
                  </li>
                );
              })}
            </DiaryTimeline>
          </div>
        ) : (
          <DiaryEmpty>Сегодня ещё ничего не записано</DiaryEmpty>
        )}
      </div>

      <DiaryStickyCta>
        <DiaryPrimaryButton onClick={save} disabled={!foodLabel}>
          {saved ? "✓ Записано" : "Записать"}
        </DiaryPrimaryButton>
      </DiaryStickyCta>
    </DiaryPage>
  );
}
