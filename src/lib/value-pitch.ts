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

export type ValuePitch = {
  eyebrow: string;
  title: string;
  intro: string;
  /** Главный плюс — крупнее остальных */
  highlight: string;
  bullets: readonly string[];
};

const PITCHES: Record<ValueAudience, ValuePitch> = {
  pregnancy: {
    eyebrow: "главное",
    title: "Мая рядом, когда тревожно",
    intro: "",
    highlight: "Чат с Маей — спокойно, без осуждения, с учётом ваших недель",
    bullets: [
      "Дневник беременности: недели, схватки, самочувствие",
      "Общение с другими мамами в чате",
    ],
  },
  baby: {
    eyebrow: "главное",
    title: "Спросите ночью — она уже в курсе",
    intro: "",
    highlight: "Чат с Маей: режим, прикорм, скачки роста — по возрасту малыша",
    bullets: [
      "Сон, кормление и рост — в одном дневнике",
      "Общение с другими мамами в чате",
    ],
  },
  cycle: {
    eyebrow: "главное",
    title: "Цикл плюс спокойный разговор",
    intro: "",
    highlight: "Чат с Маей про самочувствие — не только галочки в календаре",
    bullets: [
      "Дневник цикла и короткие заметки",
      "Общение с другими мамами в чате",
    ],
  },
  both: {
    eyebrow: "главное",
    title: "Беременность и малыш — в одной Мае",
    intro: "",
    highlight: "Чат с Маей, которая держит оба контекста",
    bullets: [
      "Дневники беременности и ухода за малышом вместе",
      "Общение с другими мамами в чате",
    ],
  },
  general: {
    eyebrow: "главное",
    title: "Мая помнит ваш контекст",
    intro: "",
    highlight: "Чат с Маей — под беременность, малыша или цикл",
    bullets: [
      "Дневники сна, кормления и самочувствия",
      "Общение с другими мамами в чате",
    ],
  },
};

export function getValuePitch(ctx: ValueContext): ValuePitch {
  return PITCHES[resolveValueAudience(ctx)];
}

/** Короткие пункты для экрана тарифов (тот же смысл). */
export function getValuePitchBullets(ctx: ValueContext): readonly string[] {
  const p = getValuePitch(ctx);
  return [p.highlight, ...p.bullets];
}
