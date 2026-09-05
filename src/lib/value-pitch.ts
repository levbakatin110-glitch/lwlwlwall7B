import type { IconName } from "@/lib/icons";

export type ValueAudience = "pregnancy" | "baby" | "cycle" | "both" | "general";

export type ValueContext = {
  pregnant: boolean;
  hasChild: boolean;
  trackCycle: boolean;
};

export function resolveValueAudience(ctx: ValueContext): ValueAudience {
  if (ctx.pregnant && ctx.hasChild) return "both";
  if (ctx.pregnant) return "pregnancy";
  if (ctx.hasChild) return "baby";
  if (ctx.trackCycle) return "cycle";
  return "general";
}

export type ValuePlus = {
  icon: IconName;
  chip: string;
  text: string;
};

export type ValuePitch = {
  eyebrow: string;
  title: string;
  /** Реплика Маи в пузыре — кто она, без загадок */
  hello: string;
  intro: string;
  highlight: string;
  pluses: readonly ValuePlus[];
  bullets: readonly string[];
};

function pack(
  hello: string,
  highlight: string,
  pluses: readonly ValuePlus[],
): ValuePitch {
  return {
    eyebrow: "помощница для мам",
    title: "Что умеет Мая",
    hello,
    intro: hello,
    highlight,
    pluses,
    bullets: pluses.map((p) => p.text),
  };
}

const PITCHES: Record<ValueAudience, ValuePitch> = {
  pregnancy: pack(
    "Привет. Я Мая — ИИ-помощница. Буду рядом на ваших неделях, без осуждения.",
    "Чат с Маей с учётом срока беременности",
    [
      {
        icon: "chat",
        chip: "Чат",
        text: "Чат с Маей: тревога, самочувствие и недели — спокойно, без осуждения",
      },
      {
        icon: "pulse",
        chip: "Недели",
        text: "Дневник беременности: недели, схватки, шевеления, визиты",
      },
      {
        icon: "bell",
        chip: "Напоминания",
        text: "Напоминания про витамины, анализы и визит к врачу",
      },
      {
        icon: "circle",
        chip: "Мамы",
        text: "Круг мам — живой чат с теми, кто на похожем сроке",
      },
      {
        icon: "notes",
        chip: "Дневник",
        text: "Самочувствие и вес — в одном месте, не по блокнотам",
      },
      {
        icon: "spark",
        chip: "Память",
        text: "Мая помнит ваш срок и прошлые ответы — не надо рассказывать заново",
      },
    ],
  ),
  baby: pack(
    "Привет. Я Мая — ИИ-помощница для мам. Помню возраст малыша, сон и кормления.",
    "Чат с Маей по возрасту вашего малыша",
    [
      {
        icon: "chat",
        chip: "Чат",
        text: "Чат с Маей: режим, прикорм, скачки роста — по возрасту малыша",
      },
      {
        icon: "sleep",
        chip: "Сон",
        text: "Сон, кормление и рост — в одном дневнике, не в заметках",
      },
      {
        icon: "bell",
        chip: "Напоминания",
        text: "Напоминания: пора кормить, дать лекарство, прививка",
      },
      {
        icon: "circle",
        chip: "Мамы",
        text: "Круг мам — спросить живых людей, не гуглить в три ночи",
      },
      {
        icon: "wardrobe",
        chip: "Одежда",
        text: "Одежда по погоде — что надеть малышу сегодня",
      },
      {
        icon: "list",
        chip: "Итоги",
        text: "Итоги дня: сколько спал, что ел, какие подгузники",
      },
    ],
  ),
  cycle: pack(
    "Привет. Я Мая. Можно писать про самочувствие — не только ставить галочки в календаре.",
    "Чат с Маей про самочувствие в разные дни цикла",
    [
      {
        icon: "chat",
        chip: "Чат",
        text: "Чат с Маей про самочувствие — не только галочки в календаре",
      },
      {
        icon: "pulse",
        chip: "Цикл",
        text: "Дневник цикла, короткие заметки и симптомы",
      },
      {
        icon: "bell",
        chip: "Напоминания",
        text: "Напоминания про таблетки и регулярные дни",
      },
      {
        icon: "circle",
        chip: "Мамы",
        text: "Круг мам — поделиться и спросить, если тревожно",
      },
      {
        icon: "notes",
        chip: "Дневник",
        text: "Самочувствие рядом с календарём, не вперемешку в заметках",
      },
      {
        icon: "spark",
        chip: "Память",
        text: "Мая помнит ваши записи и не просит повторять историю",
      },
    ],
  ),
  both: pack(
    "Привет. Я Мая. Удержу и беременность, и малыша — в одном месте.",
    "Чат с Маей, которая держит оба контекста",
    [
      {
        icon: "chat",
        chip: "Чат",
        text: "Чат с Маей: и про срок, и про малыша — без путаницы",
      },
      {
        icon: "pulse",
        chip: "Недели",
        text: "Дневник беременности и уход за малышом рядом",
      },
      {
        icon: "sleep",
        chip: "Сон",
        text: "Сон, кормление и рост младшего — в том же дневнике",
      },
      {
        icon: "bell",
        chip: "Напоминания",
        text: "Напоминания: витамины, кормление, прививка",
      },
      {
        icon: "circle",
        chip: "Мамы",
        text: "Круг мам — те, у кого тоже двое в голове сразу",
      },
      {
        icon: "list",
        chip: "Итоги",
        text: "Итоги дня по малышу и заметки по самочувствию",
      },
    ],
  ),
  general: pack(
    "Привет. Я Мая — ИИ-помощница для мам. Дневники, чат и напоминания в одном месте.",
    "Чат с Маей под вашу ситуацию",
    [
      {
        icon: "chat",
        chip: "Чат",
        text: "Чат с Маей — под беременность, малыша или цикл",
      },
      {
        icon: "notes",
        chip: "Дневники",
        text: "Дневники сна, кормления и самочувствия",
      },
      {
        icon: "bell",
        chip: "Напоминания",
        text: "Напоминания, которые не теряются в ленте",
      },
      {
        icon: "circle",
        chip: "Мамы",
        text: "Круг мам — живой чат, не бесконечная простыня советов",
      },
      {
        icon: "wardrobe",
        chip: "Одежда",
        text: "Одежда по погоде, если ведёте малыша",
      },
      {
        icon: "spark",
        chip: "Память",
        text: "Мая помнит контекст и не начинает с нуля каждый раз",
      },
    ],
  ),
};

export function getValuePitch(ctx: ValueContext): ValuePitch {
  return PITCHES[resolveValueAudience(ctx)];
}

/** Короткие пункты для экрана тарифов (тот же смысл). */
export function getValuePitchBullets(ctx: ValueContext): readonly string[] {
  const p = getValuePitch(ctx);
  return [p.highlight, ...p.bullets];
}
