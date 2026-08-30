/**
 * Справочник прививок для РФ — матрица «прививка × возраст»,
 * как в национальном календаре (приказ Минздрава № 1122н).
 *
 * Плюсы / минусы / побочки — краткие ориентиры, не медсовет.
 */

export type VaccineGroup = "calendar" | "extra";

/** Колонка возраста в таблице календаря */
export type AgeCol = {
  id: string;
  /** Короткая подпись в шапке */
  label: string;
  /** Группа шапки: мес. / годы */
  band: "m" | "y";
};

export type DoseTone = "all" | "risk" | "catchup";

export type VaccineDose = {
  id: string;
  label: string;
  ageHint: string;
  /** Колонка возраста в матрице */
  ageCol: string;
  /** Подпись в ячейке: V1, RV, … */
  cell: string;
  tone?: DoseTone;
};

export type VaccineInfo = {
  id: string;
  group: VaccineGroup;
  /** Короткая строка в первой колонке таблицы */
  name: string;
  aliases: string[];
  protects: string;
  pros: string[];
  cons: string[];
  sideEffects: string[];
  doses: VaccineDose[];
};

/** Возрасты для национального календаря (дети) */
export const CALENDAR_AGE_COLS: AgeCol[] = [
  { id: "0", label: "0", band: "m" },
  { id: "1m", label: "1", band: "m" },
  { id: "2m", label: "2", band: "m" },
  { id: "3m", label: "3", band: "m" },
  { id: "4_5m", label: "4.5", band: "m" },
  { id: "6m", label: "6", band: "m" },
  { id: "12m", label: "12", band: "m" },
  { id: "15m", label: "15", band: "m" },
  { id: "18m", label: "18", band: "m" },
  { id: "20m", label: "20", band: "m" },
  { id: "6y", label: "6", band: "y" },
  { id: "7y", label: "7", band: "y" },
  { id: "14y", label: "14", band: "y" },
  { id: "15_17y", label: "15–17", band: "y" },
];

/** Возрасты для прививок вне календаря */
export const EXTRA_AGE_COLS: AgeCol[] = [
  { id: "2m", label: "2", band: "m" },
  { id: "3m", label: "3", band: "m" },
  { id: "4_5m", label: "4.5", band: "m" },
  { id: "6m", label: "6", band: "m" },
  { id: "9m", label: "9", band: "m" },
  { id: "12m", label: "12", band: "m" },
  { id: "15m", label: "15", band: "m" },
  { id: "18m", label: "18", band: "m" },
  { id: "2_3y", label: "2–3г", band: "y" },
  { id: "6y", label: "6л", band: "y" },
  { id: "9_14y", label: "9–14", band: "y" },
];

export const CALENDAR_VACCINES: VaccineInfo[] = [
  {
    id: "bcg",
    group: "calendar",
    name: "Туберкулёз (БЦЖ)",
    aliases: ["бцж", "bcg", "туберкул"],
    protects: "Тяжёлые формы туберкулёза у детей.",
    pros: [
      "Снижает риск самых опасных форм у малышей.",
      "Одна прививка в младенчестве по календарю.",
    ],
    cons: [
      "Не защищает на 100% от заражения — снижает тяжесть.",
      "На месте укола остаётся рубец — это ожидаемо.",
    ],
    sideEffects: [
      "Папула → корочка → рубчик на плече",
      "Увеличение регионарных лимфоузлов",
      "Редко — холодный абсцесс",
    ],
    doses: [
      {
        id: "bcg-1",
        label: "Прививка",
        ageHint: "3–7 день",
        ageCol: "0",
        cell: "V",
      },
    ],
  },
  {
    id: "hepb",
    group: "calendar",
    name: "Гепатит B",
    aliases: ["гепатит b", "гепатит в", "hep b", "hbv"],
    protects: "Вирусный гепатит B и осложнения для печени.",
    pros: [
      "Защита от тяжёлого поражения печени.",
      "Первую дозу часто ставят ещё в роддоме.",
    ],
    cons: [
      "Нужен полный курс — одна доза не даёт полной защиты.",
    ],
    sideEffects: [
      "Покраснение в месте укола",
      "Небольшая температура, сонливость",
    ],
    doses: [
      {
        id: "hepb-1",
        label: "1-я доза",
        ageHint: "первые 24 ч",
        ageCol: "0",
        cell: "V1",
      },
      {
        id: "hepb-2",
        label: "2-я доза",
        ageHint: "~1 мес.",
        ageCol: "1m",
        cell: "V2",
      },
      {
        id: "hepb-3",
        label: "3-я доза",
        ageHint: "~6 мес.",
        ageCol: "6m",
        cell: "V3",
      },
    ],
  },
  {
    id: "pneumo",
    group: "calendar",
    name: "Пневмококк",
    aliases: ["пневмококк", "пневмококков", "пкв", "prevnar", "превенар"],
    protects: "Пневмонии, отиты, менингиты (пневмококк).",
    pros: ["Снижает тяжёлые бактериальные инфекции у малышей."],
    cons: ["Схема доз зависит от возраста начала."],
    sideEffects: ["Боль в месте укола", "Температура до 38–38.5 °C"],
    doses: [
      {
        id: "pneumo-1",
        label: "1-я доза",
        ageHint: "~2 мес.",
        ageCol: "2m",
        cell: "V1",
      },
      {
        id: "pneumo-2",
        label: "2-я доза",
        ageHint: "~4.5 мес.",
        ageCol: "4_5m",
        cell: "V2",
      },
      {
        id: "pneumo-3",
        label: "Ревакцинация",
        ageHint: "~15 мес.",
        ageCol: "15m",
        cell: "RV",
      },
    ],
  },
  {
    id: "dtp",
    group: "calendar",
    name: "Коклюш, дифтерия, столбняк",
    aliases: ["акдс", "коклюш", "дифтери", "столбняк", "аакдс", "dtp"],
    protects: "Коклюш, дифтерия и столбняк.",
    pros: ["Три опасные болезни — одна схема."],
    cons: ["Чаще даёт местную реакцию и температуру."],
    sideEffects: [
      "Покраснение и боль в месте укола",
      "Температура, беспокойство",
    ],
    doses: [
      {
        id: "dtp-1",
        label: "1-я доза",
        ageHint: "~3 мес.",
        ageCol: "3m",
        cell: "V1",
      },
      {
        id: "dtp-2",
        label: "2-я доза",
        ageHint: "~4.5 мес.",
        ageCol: "4_5m",
        cell: "V2",
      },
      {
        id: "dtp-3",
        label: "3-я доза",
        ageHint: "~6 мес.",
        ageCol: "6m",
        cell: "V3",
      },
      {
        id: "dtp-4",
        label: "Ревакцинация",
        ageHint: "~18 мес.",
        ageCol: "18m",
        cell: "RV1",
      },
      {
        id: "dtp-5",
        label: "Ревакцинация",
        ageHint: "~6–7 лет",
        ageCol: "6y",
        cell: "RV2",
      },
      {
        id: "dtp-6",
        label: "Ревакцинация",
        ageHint: "14 лет",
        ageCol: "14y",
        cell: "RV3",
      },
    ],
  },
  {
    id: "polio",
    group: "calendar",
    name: "Полиомиелит",
    aliases: ["полио", "полиомиелит", "опв", "ипв", "ipv", "opv"],
    protects: "Полиомиелит (паралитическая форма).",
    pros: ["Защита от инвалидизирующего заболевания."],
    cons: ["Схему ИПВ/ОПВ определяет педиатр."],
    sideEffects: ["Местная реакция", "Лёгкое недомогание"],
    doses: [
      {
        id: "polio-1",
        label: "1-я доза",
        ageHint: "~3 мес.",
        ageCol: "3m",
        cell: "V1",
      },
      {
        id: "polio-2",
        label: "2-я доза",
        ageHint: "~4.5 мес.",
        ageCol: "4_5m",
        cell: "V2",
      },
      {
        id: "polio-3",
        label: "3-я доза",
        ageHint: "~6 мес.",
        ageCol: "6m",
        cell: "V3",
      },
      {
        id: "polio-4",
        label: "Ревакцинация",
        ageHint: "~18 мес.",
        ageCol: "18m",
        cell: "RV1",
      },
      {
        id: "polio-5",
        label: "Ревакцинация",
        ageHint: "20 мес.",
        ageCol: "20m",
        cell: "RV2",
      },
      {
        id: "polio-6",
        label: "Ревакцинация",
        ageHint: "14 лет",
        ageCol: "14y",
        cell: "RV3",
      },
    ],
  },
  {
    id: "hib",
    group: "calendar",
    name: "Гемофильная инфекция",
    aliases: ["хиб", "hib", "гемофильн"],
    protects: "Гемофильная инфекция типа b.",
    pros: ["Защита от тяжёлых бактериаальных осложнений."],
    cons: ["Может идти в комбинированной вакцине."],
    sideEffects: ["Кратковременная температура", "Покраснение"],
    doses: [
      {
        id: "hib-1",
        label: "1-я доза",
        ageHint: "~3 мес.",
        ageCol: "3m",
        cell: "V1",
        tone: "risk",
      },
      {
        id: "hib-2",
        label: "2-я доза",
        ageHint: "~4.5 мес.",
        ageCol: "4_5m",
        cell: "V2",
        tone: "risk",
      },
      {
        id: "hib-3",
        label: "3-я доза",
        ageHint: "~6 мес.",
        ageCol: "6m",
        cell: "V3",
        tone: "risk",
      },
    ],
  },
  {
    id: "mmr",
    group: "calendar",
    name: "Корь, краснуха, паротит",
    aliases: ["кпк", "корь", "краснух", "паротит", "mmr"],
    protects: "Корь, краснуха и паротит.",
    pros: ["Три инфекции одной прививкой."],
    cons: ["Живая вакцина — есть противопоказания."],
    sideEffects: ["Температура через 5–12 дней", "Лёгкая сыпь"],
    doses: [
      {
        id: "mmr-1",
        label: "1-я доза",
        ageHint: "~12 мес.",
        ageCol: "12m",
        cell: "V1",
      },
      {
        id: "mmr-2",
        label: "Ревакцинация",
        ageHint: "~6 лет",
        ageCol: "6y",
        cell: "RV",
      },
    ],
  },
  {
    id: "flu",
    group: "calendar",
    name: "Грипп",
    aliases: ["грипп", "influenza", "флю"],
    protects: "Сезонный грипп и его осложнения.",
    pros: ["Снижает тяжёлое течение в сезон."],
    cons: ["Состав обновляют каждый год."],
    sideEffects: ["Лёгкая температура", "Боль в месте укола"],
    doses: [
      {
        id: "flu-annual",
        label: "Сезонная",
        ageHint: "ежегодно с ~6 мес.",
        ageCol: "6m",
        cell: "ежег.",
        tone: "risk",
      },
    ],
  },
];

export const EXTRA_VACCINES: VaccineInfo[] = [
  {
    id: "rota",
    group: "extra",
    name: "Ротавирус",
    aliases: ["ротавирус", "ротатек", "ротарикс", "rota"],
    protects: "Тяжёлая ротавирусная диарея у малышей.",
    pros: ["Снижает госпитализации", "Капли в рот"],
    cons: ["Строгие возрастные окна", "Часто платная"],
    sideEffects: ["Лёгкое расстройство стула"],
    doses: [
      {
        id: "rota-1",
        label: "1-я доза",
        ageHint: "~2 мес.",
        ageCol: "2m",
        cell: "V1",
      },
      {
        id: "rota-2",
        label: "2-я доза",
        ageHint: "~3 мес.",
        ageCol: "3m",
        cell: "V2",
      },
      {
        id: "rota-3",
        label: "3-я доза",
        ageHint: "~4.5 мес.",
        ageCol: "4_5m",
        cell: "V3",
      },
    ],
  },
  {
    id: "meningo",
    group: "extra",
    name: "Менингококк",
    aliases: ["менингококк", "менинго", "менвео"],
    protects: "Менингококковая инфекция.",
    pros: ["Защита от тяжёлой быстротекущей инфекции."],
    cons: ["Обычно платная."],
    sideEffects: ["Боль в месте укола", "Температура"],
    doses: [
      {
        id: "meningo-1",
        label: "1-я доза",
        ageHint: "с ~9 мес. / по схеме",
        ageCol: "9m",
        cell: "V1",
      },
      {
        id: "meningo-2",
        label: "2-я / бустер",
        ageHint: "по схеме",
        ageCol: "15m",
        cell: "V2",
      },
    ],
  },
  {
    id: "varicella",
    group: "extra",
    name: "Ветряная оспа",
    aliases: ["ветрян", "varicella", "варицелл"],
    protects: "Ветрянка и её осложнения.",
    pros: ["Снижает риск тяжёлого течения."],
    cons: ["Обычно платная."],
    sideEffects: ["Местная реакция", "Лёгкая температура"],
    doses: [
      {
        id: "varicella-1",
        label: "1-я доза",
        ageHint: "с ~12 мес.",
        ageCol: "12m",
        cell: "V1",
      },
      {
        id: "varicella-2",
        label: "2-я доза",
        ageHint: "через 6+ нед. / ~6 лет",
        ageCol: "6y",
        cell: "V2",
      },
    ],
  },
  {
    id: "hepa",
    group: "extra",
    name: "Гепатит A",
    aliases: ["гепатит a", "гепатит а", "hep a"],
    protects: "Вирусный гепатит A.",
    pros: ["Полезна перед поездками."],
    cons: ["Часто по эпидпоказаниям или платно."],
    sideEffects: ["Боль в месте укола"],
    doses: [
      {
        id: "hepa-1",
        label: "1-я доза",
        ageHint: "с ~12 мес.",
        ageCol: "12m",
        cell: "V1",
      },
      {
        id: "hepa-2",
        label: "2-я доза",
        ageHint: "через 6–12 мес.",
        ageCol: "18m",
        cell: "V2",
      },
    ],
  },
  {
    id: "tick",
    group: "extra",
    name: "Клещевой энцефалит",
    aliases: ["клещев", "энцефалит", "клещ"],
    protects: "Клещевой энцефалит (по региону риска).",
    pros: ["Важна в эндемичных регионах."],
    cons: ["Нужно успеть до сезона клещей."],
    sideEffects: ["Местная реакция", "Температура"],
    doses: [
      {
        id: "tick-1",
        label: "1-я доза",
        ageHint: "осень / зима",
        ageCol: "2_3y",
        cell: "V1",
        tone: "risk",
      },
      {
        id: "tick-2",
        label: "2-я доза",
        ageHint: "через 1–7 мес.",
        ageCol: "6y",
        cell: "V2",
        tone: "risk",
      },
    ],
  },
  {
    id: "hpv",
    group: "extra",
    name: "ВПЧ",
    aliases: ["впч", "hpv", "папиллом", "гаардасил"],
    protects: "Вирус папилломы человека.",
    pros: ["Лучше до начала половой жизни."],
    cons: ["Для подростков; часто платная."],
    sideEffects: ["Боль в месте укола"],
    doses: [
      {
        id: "hpv-1",
        label: "1-я доза",
        ageHint: "с ~9–14 лет",
        ageCol: "9_14y",
        cell: "V1",
      },
      {
        id: "hpv-2",
        label: "2-я доза",
        ageHint: "через 6 мес.",
        ageCol: "9_14y",
        cell: "V2",
      },
    ],
  },
];

export const VACCINES_CATALOG: VaccineInfo[] = [
  ...CALENDAR_VACCINES,
  ...EXTRA_VACCINES,
];

export const VACCINE_SOURCE_NOTE =
  "Таблица как в национальном календаре РФ (приказ Минздрава № 1122н). Жёлтый — всем, сиреневый — группам риска. Не замена педиатру.";

export function vaccinesByGroup(group: VaccineGroup) {
  return VACCINES_CATALOG.filter((v) => v.group === group);
}

export function findVaccineById(id: string) {
  return VACCINES_CATALOG.find((v) => v.id === id);
}

export function findDose(doseId: string) {
  for (const v of VACCINES_CATALOG) {
    const d = v.doses.find((x) => x.id === doseId);
    if (d) return { vaccine: v, dose: d };
  }
  return null;
}

/** Сопоставить свободный текст записи с дозой каталога */
export function matchDoseFromText(text: string): string | null {
  const t = text.toLowerCase();
  for (const v of VACCINES_CATALOG) {
    const hit = v.aliases.some((a) => t.includes(a));
    if (!hit && !t.includes(v.name.toLowerCase())) continue;

    if (/ревакц|revacc|бустер|4[-‑]?я|четвёрт/i.test(t)) {
      const rev = v.doses.find((d) => /ревакц|сезонн|бустер|RV/i.test(d.label + d.cell));
      if (rev) return rev.id;
      const last = v.doses[v.doses.length - 1];
      if (last) return last.id;
    }
    const num = t.match(/(\d)[-‑]?\s*(?:я|й|ю)?\s*доз/);
    if (num) {
      const idx = Number(num[1]) - 1;
      if (v.doses[idx]) return v.doses[idx].id;
    }
    if (/1[-‑]?я|перв/i.test(t) && v.doses[0]) return v.doses[0].id;
    if (/2[-‑]?я|втор/i.test(t) && v.doses[1]) return v.doses[1].id;
    if (/3[-‑]?я|трет/i.test(t) && v.doses[2]) return v.doses[2].id;

    if (v.doses.length === 1) return v.doses[0].id;
    return v.doses[0]?.id ?? null;
  }
  return null;
}
