import type { JournalEntry, ModuleId } from "@/lib/types";
import { MODULE_BY_ID } from "@/lib/modules";

export type DiaryOffer = {
  moduleId: ModuleId;
  /** enable = ещё не подключён; open = уже есть, зовём открыть трекер */
  mode: "enable" | "open";
  title: string;
  body: string;
  cta: string;
};

const RULES: {
  re: RegExp;
  id: ModuleId;
  enableBody: string;
  openBody: string;
  openCta: string;
}[] = [
  {
    re: /смес|бутыл|\d+\s*мл|искусственн/i,
    id: "formula",
    enableBody: "Могу вести бутылочку: мл, марка, сумма за день. Завести?",
    openBody: "Есть трекер бутылочки — налили и записали в одно касание.",
    openCta: "Открыть бутылочку",
  },
  {
    re: /груд(?:ь|ного|ное)|кормл|сосал|\bгв\b|левая|правая груд/i,
    id: "breastfeeding",
    enableBody: "Могу засекать ГВ: левая/правая грудь и таймер. Завести дневник?",
    openBody: "Таймер ГВ уже есть — выберите сторону и засеките.",
    openCta: "Открыть таймер ГВ",
  },
  {
    re: /прикорм|кабачок|пюре|ложк|каш[аеи]|брокколи|тыкв/i,
    id: "solids",
    enableBody: "Могу вести прикорм: продукт, порция, реакция. Создать?",
    openBody: "Дневник прикорма готов — можно быстро отметить, что пробовали.",
    openCta: "Открыть прикорм",
  },
  {
    re: /сон|спал|уснул|ночн|дневн(?:ой|ый)\s*сон|режим сна/i,
    id: "sleep",
    enableBody: "Могу засекать сон таймером — дневной и ночной. Завести?",
    openBody: "Трекер сна уже подключён — нажмите и засеките, пока спит.",
    openCta: "Засечь сон",
  },
  {
    re: /прививк|акдс|вакцин|привит/i,
    id: "vaccines",
    enableBody: "Могу вести прививки и напоминать по возрасту. Завести дневник?",
    openBody: "Дневник прививок уже есть — загляните, когда будет удобно.",
    openCta: "Открыть прививки",
  },
  {
    re: /температур|кашля|сопл|врач|педиатр|боле/i,
    id: "health",
    enableBody: "Могу запоминать температуру и симптомы (не вместо врача). Завести?",
    openBody: "Дневник здоровья подключён — можно коротко записать самочувствие.",
    openCta: "Открыть здоровье",
  },
  {
    re: /диет|калор|похуд|сброс(?:ить)?\s*вес|ккал|похудеть|поправлени/i,
    id: "diet",
    enableBody: "Могу вести диету: расчёт ккал по росту/весу и цель сброса. Завести?",
    openBody: "Диета уже есть — план калорий и лог приёмов пищи.",
    openCta: "Открыть диету",
  },
];

/** Если мама пишет про тему дневника — предложить завести или открыть трекер */
export function inferDiaryOffer(
  text: string,
  enabledModules: string[],
  journals: Record<string, JournalEntry[]>,
): DiaryOffer | null {
  const t = text.trim();
  if (t.length < 4) return null;

  for (const r of RULES) {
    if (!r.re.test(t)) continue;
    const mod = MODULE_BY_ID[r.id];
    if (!mod) continue;

    if (!enabledModules.includes(r.id)) {
      return {
        moduleId: r.id,
        mode: "enable",
        title: mod.title,
        body: r.enableBody,
        cta: "Завести дневник",
      };
    }

    const empty = (journals[r.id]?.length ?? 0) === 0;
    // пустой дневник или явный интерес к трекеру
    if (empty || /завест|создай|включ|засеч|откры|как вести|дневник/i.test(t)) {
      return {
        moduleId: r.id,
        mode: "open",
        title: mod.title,
        body: r.openBody,
        cta: r.openCta,
      };
    }
  }
  return null;
}
