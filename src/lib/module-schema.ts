import { normalizeIconName } from "@/lib/icons";
import { isBuiltinModuleId } from "@/lib/modules";
import type {
  ModuleBlueprint,
  ModuleField,
  SmartPanel,
  SmartPanelKind,
} from "./types";

const ALLOWED_TYPES = new Set(["text", "number", "date", "select", "textarea"]);
const SMART_KINDS = new Set<SmartPanelKind>([
  "milestones",
  "goal",
  "tips",
  "scale",
  "streak",
  "timer",
]);

function slugKey(label: string, index: number) {
  const base = label
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  return base || `field_${index + 1}`;
}

function normalizeSmart(
  raw: Partial<SmartPanel> | undefined,
  fieldKeys: Set<string>,
): SmartPanel | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const kind = String(raw.kind || "") as SmartPanelKind;
  if (!SMART_KINDS.has(kind)) return undefined;

  const smart: SmartPanel = {
    kind,
    title: String(raw.title || "Помощник").slice(0, 80),
    subtitle: raw.subtitle ? String(raw.subtitle).slice(0, 200) : undefined,
  };

  if (kind === "milestones" && Array.isArray(raw.milestones)) {
    smart.milestones = raw.milestones.slice(0, 16).map((m, i) => ({
      id: String(m?.id || `m${i + 1}`).slice(0, 32),
      label: String(m?.label || `Вехa ${i + 1}`).slice(0, 120),
      hint: m?.hint ? String(m.hint).slice(0, 160) : undefined,
    }));
  }

  if (kind === "goal") {
    smart.goalLabel = String(raw.goalLabel || "Цель").slice(0, 60);
    smart.goalTarget = Number(raw.goalTarget) || 10;
    smart.goalUnit = raw.goalUnit ? String(raw.goalUnit).slice(0, 24) : "";
    const gk = raw.goalFieldKey ? String(raw.goalFieldKey) : undefined;
    smart.goalFieldKey = gk && fieldKeys.has(gk) ? gk : undefined;
  }

  if (kind === "tips" || kind === "milestones" || kind === "streak") {
    if (Array.isArray(raw.tips)) {
      smart.tips = raw.tips.map(String).slice(0, 6);
    }
    if (Array.isArray(raw.quickAdds)) {
      smart.quickAdds = raw.quickAdds.slice(0, 8).map((q) => ({
        label: String(q?.label || "Запись").slice(0, 40),
        prefill: String(q?.prefill || "").slice(0, 200),
      }));
    }
  }

  if (kind === "scale") {
    smart.scaleMinLabel = String(raw.scaleMinLabel || "слабо").slice(0, 40);
    smart.scaleMaxLabel = String(raw.scaleMaxLabel || "отлично").slice(0, 40);
    const sk = raw.scaleFieldKey ? String(raw.scaleFieldKey) : undefined;
    smart.scaleFieldKey = sk && fieldKeys.has(sk) ? sk : undefined;
  }

  if (kind === "streak") {
    smart.streakLabel = String(raw.streakLabel || "Дней подряд").slice(0, 60);
  }

  if (kind === "timer") {
    smart.timerLabel = String(raw.timerLabel || "Занятие").slice(0, 60);
    smart.timerUnit = String(raw.timerUnit || "мин").slice(0, 12);
  }

  return smart;
}

/** Локальный умный шаблон, если ИИ не вернул smart */
export function fallbackSmartForTopic(text: string): SmartPanel | undefined {
  const t = text.toLowerCase();
  if (/развит|вех|навык|переворот|сел|пополз|первые\s*шаг|говорил/i.test(t)) {
    return {
      kind: "milestones",
      title: "Вехи развития",
      subtitle: "Отмечайте, когда малыш освоил навык — можно в любом порядке.",
      milestones: [
        { id: "hold_head", label: "Держит голову", hint: "обычно с ~2–3 мес." },
        { id: "roll", label: "Переворачивается", hint: "часто с ~4–6 мес." },
        { id: "sit", label: "Сидит с опорой / сам", hint: "~6–8 мес." },
        { id: "crawl", label: "Ползает", hint: "~7–10 мес." },
        { id: "stand", label: "Встаёт у опоры", hint: "~8–12 мес." },
        { id: "walk", label: "Первые шаги", hint: "~10–15 мес." },
        { id: "words", label: "Первые слова", hint: "индивидуально" },
        { id: "point", label: "Показывает пальцем / жесты", hint: "~9–14 мес." },
      ],
      tips: [
        "Все дети разные — вехи ориентир, не гонка.",
        "Можно отметить дату в записи своими словами.",
      ],
      quickAdds: [
        { label: "Новый навык", prefill: "Сегодня впервые: " },
        { label: "Пробуем", prefill: "Пробуем навык: " },
      ],
    };
  }
  if (/мотор|занят|упражн|практик|массаж|лепк|рисова|гимнаст/i.test(t)) {
    return {
      kind: "timer",
      title: "Таймер занятия",
      subtitle: "Засеките — в запись уйдёт время.",
      timerLabel: "Занятие",
      timerUnit: "мин",
      tips: ["Можно остановить и сразу сохранить."],
    };
  }
  if (/настроен|стресс|тревог|эмоц/i.test(t)) {
    return {
      kind: "scale",
      title: "Как вы сегодня",
      subtitle: "Короткая шкала — чтобы видеть динамику.",
      scaleMinLabel: "тяжело",
      scaleMaxLabel: "спокойно",
      scaleFieldKey: "score",
      tips: ["Это для вас, не диагноз."],
    };
  }
  if (/привычк|вод[аы]|шаг|спорт|зарядк/i.test(t)) {
    return {
      kind: "streak",
      title: "Серия дней",
      subtitle: "Отмечайте день — копится серия.",
      streakLabel: "Дней подряд",
      quickAdds: [
        { label: "Сделано сегодня", prefill: "Сделано" },
        { label: "Пропуск", prefill: "Пропуск" },
      ],
    };
  }
  if (/цел|прогресс|накопи|лимит/i.test(t)) {
    return {
      kind: "goal",
      title: "К цели",
      subtitle: "Сколько уже набрали относительно ориентира.",
      goalLabel: "Прогресс",
      goalTarget: 10,
      goalUnit: "",
    };
  }
  return {
    kind: "tips",
    title: "Как вести",
    subtitle: "Пишите свободно — кнопки лишь ускоряют.",
    tips: [
      "Можно одной фразой или подробно — как удобно.",
      "В чате с Маей тоже можно диктовать факты в этот дневник.",
    ],
    quickAdds: [{ label: "Короткая запись", prefill: "" }],
  };
}

/** Если тема уже закрыта готовым разделом */
export function detectBuiltinSuggestion(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/диет|калор|похуд|ккал|похудеть/i.test(t)) return "diet";
  if (/груд(?:ь|ного)|кормлен|\bгв\b/i.test(t) && !/смес|бутыл/i.test(t))
    return "breastfeeding";
  if (/смес|бутыл/i.test(t)) return "formula";
  if (/прикорм|пюре/i.test(t)) return "solids";
  if (/сон|режим сна/i.test(t)) return "sleep";
  if (/рост|вес малыш|вес ребён/i.test(t)) return "growth";
  if (/прививк|вакцин/i.test(t)) return "vaccines";
  if (/температур|симптом|болезн/i.test(t)) return "health";
  return undefined;
}

export function normalizeBlueprint(
  raw: Partial<ModuleBlueprint>,
  topicHint = "",
): ModuleBlueprint {
  const fieldsIn = Array.isArray(raw.fields) ? raw.fields : [];
  const fields: ModuleField[] = fieldsIn.slice(0, 8).map((f, i) => {
    const type = ALLOWED_TYPES.has(String(f?.type))
      ? (f.type as ModuleField["type"])
      : "text";
    const key = String(f?.key || slugKey(String(f?.label || ""), i))
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .slice(0, 32);
    return {
      key: key || `field_${i + 1}`,
      label: String(f?.label || `Поле ${i + 1}`),
      type,
      placeholder: f?.placeholder ? String(f.placeholder) : undefined,
      options:
        type === "select" && Array.isArray(f?.options)
          ? f.options.map(String).slice(0, 12)
          : undefined,
      required: Boolean(f?.required),
    };
  });

  if (fields.length === 0) {
    fields.push({
      key: "note",
      label: "Запись",
      type: "textarea",
      placeholder: "Напишите как удобно",
      required: true,
    });
  }

  // для шкалы настроения удобно иметь числовое поле
  const topic = `${topicHint} ${raw.title || ""} ${raw.description || ""}`;
  if (/настроен|эмоц|стресс/i.test(topic) && !fields.some((f) => f.key === "score")) {
    fields.unshift({
      key: "score",
      label: "Оценка",
      type: "number",
      placeholder: "1–10",
      required: false,
    });
  }
  if (
    (/мотор|занят|упражн|практик|массаж|лепк|рисова|гимнаст|timer/i.test(topic) ||
      raw.smart?.kind === "timer") &&
    !fields.some((f) => f.key === "minutes")
  ) {
    fields.unshift({
      key: "minutes",
      label: "Минуты",
      type: "number",
      placeholder: "10",
      required: false,
    });
  }

  const keys = new Set(fields.map((f) => f.key));
  let chartFieldKey = raw.chartFieldKey ? String(raw.chartFieldKey) : undefined;
  if (chartFieldKey && !keys.has(chartFieldKey)) chartFieldKey = undefined;
  if (!chartFieldKey) {
    chartFieldKey = fields.find((f) => f.type === "number")?.key;
  }

  let smart = normalizeSmart(raw.smart, keys);
  if (!smart) smart = fallbackSmartForTopic(topic);

  if (smart?.kind === "goal" && !smart.goalFieldKey) {
    smart.goalFieldKey = chartFieldKey;
  }
  if (smart?.kind === "scale" && !smart.scaleFieldKey) {
    smart.scaleFieldKey =
      fields.find((f) => f.key === "score")?.key || chartFieldKey;
  }

  const suggestRaw = raw.suggestBuiltin ? String(raw.suggestBuiltin) : undefined;
  const suggestBuiltin =
    (suggestRaw && isBuiltinModuleId(suggestRaw) && suggestRaw) ||
    detectBuiltinSuggestion(topic) ||
    undefined;

  return {
    title: String(raw.title || "Мой дневник").slice(0, 60),
    description: String(raw.description || "").slice(0, 240),
    icon: normalizeIconName(String(raw.icon || "spark")),
    fields,
    chartFieldKey,
    smart,
    suggestBuiltin,
  };
}

export function summarizeEntryFields(
  fields: ModuleField[],
  values: Record<string, string | number>,
): string {
  return fields
    .map((f) => {
      const v = values[f.key];
      if (v === undefined || v === "") return null;
      return `${f.label}: ${v}`;
    })
    .filter(Boolean)
    .join(" · ");
}

/** Оставляет в записях только актуальные ключи схемы */
export function migrateJournalFields(
  entries: {
    id: string;
    date: string;
    value: string;
    note: string;
    fields?: Record<string, string | number>;
  }[],
  fields: ModuleField[],
): typeof entries {
  const keep = new Set(fields.map((f) => f.key));
  return entries.map((e) => {
    if (!e.fields) return e;
    const next: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(e.fields)) {
      if (keep.has(k)) next[k] = v;
    }
    return {
      ...e,
      fields: next,
      value: summarizeEntryFields(fields, next) || e.value,
    };
  });
}
