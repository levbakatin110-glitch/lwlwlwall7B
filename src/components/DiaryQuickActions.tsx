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
  diaper: [
    { label: "Мокрый", instant: { value: "Мокрый" } },
    { label: "Грязный", instant: { value: "Грязный" } },
    { label: "Оба", instant: { value: "Мокрый и грязный" } },
  ],
  diet: [
    { label: "Завтрак", prefill: "Завтрак · 350 ккал" },
    { label: "Обед", prefill: "Обед · 500 ккал" },
    { label: "Ужин", prefill: "Ужин · 400 ккал" },
    { label: "Перекус", prefill: "Перекус · 150 ккал" },
  ],
  preg_weight: [
    { label: "65 кг", prefill: "65 кг" },
    { label: "68 кг", prefill: "68 кг" },
    { label: "+0.5 кг", prefill: "+0.5 кг за неделю" },
  ],
  preg_pressure: [
    { label: "120/80", prefill: "120/80 · пульс 72" },
    { label: "110/70", prefill: "110/70 · пульс 78" },
    { label: "130/85", prefill: "130/85 · пульс 80" },
  ],
  preg_symptoms: [
    { label: "Тошнота", prefill: "Тошнота утром" },
    { label: "Изжога", prefill: "Изжога" },
    { label: "Отёки", prefill: "Отёки ног вечером" },
    { label: "Нормально", prefill: "Самочувствие хорошее" },
  ],
  preg_visits: [
    { label: "ЖК", prefill: "Приём в ЖК" },
    { label: "УЗИ", prefill: "УЗИ" },
    { label: "Анализы", prefill: "Сдала анализы" },
  ],
  preg_belly: [
    { label: "Окружность", prefill: "90 см" },
    { label: "Фото-заметка", prefill: "Фото животика на этой неделе" },
  ],
  preg_meds: [
    { label: "Фолиевая", instant: { value: "Фолиевая кислота" } },
    { label: "Витамин D", instant: { value: "Витамин D" } },
    { label: "Железо", prefill: "Железо · по схеме врача" },
  ],
  preg_labs: [
    { label: "ОАК", prefill: "ОАК" },
    { label: "УЗИ", prefill: "УЗИ" },
    { label: "Скрининг", prefill: "Скрининг" },
  ],
  birth_plan: [
    { label: "Партнёр рядом", prefill: "Партнёр рядом на родах" },
    { label: "Контакт кожа-к-коже", prefill: "Контакт кожа-к-коже сразу" },
  ],
  cycle: [
    { label: "1-й день", instant: { value: "1-й день цикла" } },
    { label: "Овуляция", prefill: "Овуляция · тест +" },
    { label: "Самочувствие", prefill: "Самочувствие нормальное" },
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
                const diaperKind =
                  moduleId === "diaper"
                    ? /грязн/i.test(chip.instant.value) &&
                      /мокр/i.test(chip.instant.value)
                      ? "both"
                      : /грязн/i.test(chip.instant.value)
                        ? "dirty"
                        : "wet"
                    : null;
                addJournalEntry(moduleId, {
                  date: new Date().toISOString().slice(0, 10),
                  value: chip.instant.value,
                  note: chip.instant.note ?? "",
                  fields:
                    moduleId === "formula" && ml
                      ? { ml: Number(ml[1]) }
                      : diaperKind
                        ? { kind: diaperKind, rash: 0 }
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
