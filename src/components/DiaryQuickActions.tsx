"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

type Chip = {
  label: string;
  prefill?: string;
  instant?: { value: string; note?: string };
  askMaya?: boolean;
};

const CHIPS: Record<string, Chip[]> = {
  growth: [
    { label: "Вес", prefill: "8.2 кг" },
    { label: "Рост", prefill: "68 см" },
    { label: "Вес и рост", prefill: "68 см, 8.2 кг" },
    { label: "+100 г", prefill: "+0.1 кг" },
  ],
  health: [
    { label: "36.6", instant: { value: "36.6 °C", note: "температура" } },
    { label: "37.2", instant: { value: "37.2 °C", note: "температура" } },
    { label: "Сопли", prefill: "Сопли, самочувствие нормальное" },
    { label: "К педиатру", prefill: "Визит к педиатру" },
  ],
  vaccines: [
    { label: "АКДС", prefill: "АКДС" },
    { label: "Полиомиелит", prefill: "Полиомиелит" },
    { label: "Гепатит B", prefill: "Гепатит B" },
  ],
  sleep: [
    { label: "Дневной сон", prefill: "Дневной сон 1.5 ч" },
    { label: "Ночь", prefill: "Ночь 22:00–6:30" },
    { label: "Проснулся ночью", prefill: "Просыпался ночью 2 раза" },
  ],
  breastfeeding: [
    { label: "Левая 10 мин", instant: { value: "левая 10 мин" } },
    { label: "Правая 10 мин", instant: { value: "правая 10 мин" } },
    { label: "Обе стороны", prefill: "левая 8 мин, правая 7 мин" },
  ],
  formula: [
    { label: "90 мл", instant: { value: "90 мл" } },
    { label: "120 мл", instant: { value: "120 мл" } },
    { label: "150 мл", instant: { value: "150 мл" } },
  ],
  solids: [
    { label: "Кабачок", prefill: "кабачок · 2 ч.л." },
    { label: "Каша", prefill: "каша · 2 ч.л." },
    { label: "Фрукт", prefill: "яблоко · пробование" },
  ],
  diet: [
    { label: "Завтрак", prefill: "Завтрак · 350 ккал" },
    { label: "Обед", prefill: "Обед · 500 ккал" },
    { label: "Ужин", prefill: "Ужин · 400 ккал" },
    { label: "Перекус", prefill: "Перекус · 150 ккал" },
  ],
};

/** Быстрые действия — подсказки, не единственный сценарий */
export function DiaryQuickActions({
  moduleId,
  onPrefill,
}: {
  moduleId: string;
  onPrefill: (text: string) => void;
}) {
  const router = useRouter();
  const addJournalEntry = useAppStore((s) => s.addJournalEntry);
  const setPendingChatPrompt = useAppStore((s) => s.setPendingChatPrompt);

  const list: Chip[] = CHIPS[moduleId] ?? [
    { label: "Короткая запись", prefill: "" },
    { label: "Спросить Маю", askMaya: true },
  ];

  return (
    <div className="mt-4 rounded-[1.25rem] border border-line bg-card/60 px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Быстро
        </p>
        <Link
          href="/"
          onClick={() =>
            setPendingChatPrompt(
              "Хочу записать в дневник — помоги оформить коротко, как удобно.",
            )
          }
          className="text-[11px] font-semibold text-accent hover:underline"
        >
          Через чат →
        </Link>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {list.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => {
              if (chip.askMaya) {
                setPendingChatPrompt(
                  "По разделу хочу сделать запись — подскажи, что полезно отметить.",
                );
                router.push("/");
                return;
              }
              if (chip.instant) {
                const ml = chip.instant.value.match(/(\d+)\s*мл/i);
                addJournalEntry(moduleId, {
                  date: new Date().toISOString().slice(0, 10),
                  value: chip.instant.value,
                  note: chip.instant.note ?? "",
                  fields:
                    moduleId === "formula" && ml
                      ? { ml: Number(ml[1]) }
                      : undefined,
                });
                return;
              }
              onPrefill(chip.prefill ?? "");
            }}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-accent/40 hover:bg-accent-soft"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
