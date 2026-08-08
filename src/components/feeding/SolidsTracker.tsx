"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";

const FOODS = [
  "кабачок",
  "цветная капуста",
  "брокколи",
  "тыква",
  "яблоко",
  "груша",
  "банан",
  "каша рисовая",
  "каша гречневая",
  "творог",
  "мясо",
  "рыба",
] as const;

const PORTIONS = [
  { id: "taste", label: "на кончике", value: "пробование" },
  { id: "1tsp", label: "1 ч.л.", value: "1 ч.л." },
  { id: "2tsp", label: "2 ч.л.", value: "2 ч.л." },
  { id: "3tsp", label: "3 ч.л.", value: "3 ч.л." },
  { id: "half", label: "½ банки", value: "½ порции" },
  { id: "full", label: "баночка", value: "целая порция" },
] as const;

const REACTIONS = [
  { id: "ok", label: "ок", tone: "care" },
  { id: "liked", label: "нравится", tone: "care" },
  { id: "refused", label: "отказался", tone: "notice" },
  { id: "rash", label: "сыпь / реакция", tone: "hot" },
] as const;

export function SolidsTracker() {
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const [food, setFood] = useState("");
  const [custom, setCustom] = useState("");
  const [portion, setPortion] = useState<string>("1tsp");
  const [reaction, setReaction] = useState<string>("ok");
  const [savedFlash, setSavedFlash] = useState(false);

  const foodLabel = food === "__custom" ? custom.trim() : food;

  function save() {
    if (!foodLabel) return;
    const portionLabel =
      PORTIONS.find((p) => p.id === portion)?.value || portion;
    const reactionLabel =
      REACTIONS.find((r) => r.id === reaction)?.label || reaction;
    addJournalEntry("solids", {
      date: new Date().toISOString().slice(0, 10),
      value: `${foodLabel} · ${portionLabel}`,
      note: reactionLabel,
      fields: {
        food: foodLabel,
        portion: portionLabel,
        reaction: reaction,
      },
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  }

  return (
    <div className="maya-rise overflow-hidden rounded-[1.5rem] border border-line bg-card/80 p-4 sm:p-5">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        Что пробовали?
      </h2>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {FOODS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFood(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              food === f
                ? "bg-accent text-[#ffffff]"
                : "border border-line text-muted hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFood("__custom")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            food === "__custom"
              ? "bg-accent text-[#ffffff]"
              : "border border-dashed border-accent/40 text-accent"
          }`}
        >
          другое…
        </button>
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

      <p className="mb-1.5 mt-5 text-[11px] text-muted">Сколько</p>
      <div className="flex flex-wrap gap-1.5">
        {PORTIONS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPortion(p.id)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              portion === p.id
                ? "bg-accent-soft text-accent ring-1 ring-accent/30"
                : "border border-line text-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="mb-1.5 mt-5 text-[11px] text-muted">Реакция</p>
      <div className="flex flex-wrap gap-1.5">
        {REACTIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReaction(r.id)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              reaction === r.id
                ? r.id === "rash" || r.id === "refused"
                  ? "bg-blush-soft text-blush ring-1 ring-blush/30"
                  : "bg-accent-soft text-accent ring-1 ring-accent/30"
                : "border border-line text-muted"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!foodLabel}
        onClick={save}
        className="mt-5 w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-[#ffffff] disabled:opacity-40"
      >
        Записать прикорм
      </button>
      {savedFlash && (
        <p className="maya-msg-in mt-3 text-sm font-medium text-accent">
          Записано · Мая учтёт аллергии и новые продукты
        </p>
      )}
    </div>
  );
}
