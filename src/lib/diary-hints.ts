export type DiaryHintExample = {
  label: string;
  prompt: string;
};

export type DiaryHint = {
  body: string;
  examples: DiaryHintExample[];
};

export const WARDROBE_HINT: DiaryHint = {
  body: "Фото вещей → в чате спросите, что надеть.",
  examples: [
    {
      label: "Что надеть?",
      prompt:
        "Хочу выйти погулять с малышом — во что его одеть под сегодняшнюю погоду?",
    },
  ],
};

export const DIARY_HINTS: Record<string, DiaryHint> = {
  growth: {
    body: "Пишите сюда или в чат: «вес 8.2 кг, рост 68 см».",
    examples: [
      {
        label: "Как растёт?",
        prompt: "Покажи, как менялся рост малыша за последние месяцы.",
      },
    ],
  },
  breastfeeding: {
    body: "Таймер слева/справа — и запись готова.",
    examples: [],
  },
  formula: {
    body: "Выберите мл на бутылочке.",
    examples: [],
  },
  solids: {
    body: "Продукт → порция → реакция.",
    examples: [],
  },
  sleep: {
    body: "Дневной или ночной — засеките таймером.",
    examples: [],
  },
  vaccines: {
    body: "Отмечайте сделанные прививки.",
    examples: [
      {
        label: "Записать прививку",
        prompt: "Сегодня сделали АКДС — запиши в дневник прививок.",
      },
    ],
  },
  health: {
    body: "Температура и симптомы — для памяти. Не вместо врача.",
    examples: [
      {
        label: "Записать",
        prompt: "Температура 37.2 — запиши в дневник здоровья.",
      },
    ],
  },
  diet: {
    body: "Рост, вес, цель — Мая посчитает ккал и учтёт приёмы пищи.",
    examples: [],
  },
};

export const CUSTOM_DIARY_HINT: DiaryHint = {
  body: "Пишите сюда или скажите Мае в чате.",
  examples: [
    {
      label: "Спросить Маю",
      prompt: "Посмотри по моим дневникам — что важно учесть сегодня?",
    },
  ],
};

export const MEMORIES_HINT: DiaryHint = {
  body: "Фото с датой — Мая соберёт историю.",
  examples: [
    {
      label: "Наша история",
      prompt:
        "Расскажи историю малыша по нашим моментам — коротко, по порядку.",
    },
  ],
};

export function hintForDiary(moduleId: string, isCustom?: boolean): DiaryHint {
  if (DIARY_HINTS[moduleId]) return DIARY_HINTS[moduleId];
  if (isCustom) return CUSTOM_DIARY_HINT;
  return CUSTOM_DIARY_HINT;
}
