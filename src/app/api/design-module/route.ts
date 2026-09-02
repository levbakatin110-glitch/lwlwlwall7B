import { designModel, createOpenAI } from "@/lib/openai";
import { validateBlueprint } from "@/lib/blueprint-health";
import {
  detectBuiltinSuggestion,
  normalizeBlueprint,
} from "@/lib/module-schema";
import {
  isRecipesCatalogModule,
  isRecipesCatalogTopic,
  RECIPES_BUILTIN_SUGGEST,
  RECIPES_CATALOG_LABEL,
} from "@/lib/recipes";
import { pushServerOpsError } from "@/lib/ops-log";
import type { ModuleBlueprint } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const openai = createOpenAI();
  if (!openai) {
    return Response.json(
      { error: "Не настроен ключ ИИ. Добавьте OPENAI_API_KEY в .env.local." },
      { status: 500 },
    );
  }

  let description = "";
  let titleHint = "";
  try {
    const body = (await req.json()) as { description?: string; titleHint?: string };
    description = String(body.description || "").trim();
    titleHint = String(body.titleHint || "").trim();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (description.length < 3) {
    return Response.json({ error: "Опишите, что хотите отслеживать" }, { status: 400 });
  }

  const topic = `${titleHint} ${description}`;
  const builtin = detectBuiltinSuggestion(topic);
  if (builtin) {
    const isRecipes = builtin === RECIPES_BUILTIN_SUGGEST;
    return Response.json({
      title: isRecipes ? RECIPES_CATALOG_LABEL : "",
      description: isRecipes
        ? "Каталог блюд — смотрите и готовьте, без записей в дневник."
        : "",
      icon: isRecipes ? "diet" : "spark",
      fields: [],
      suggestBuiltin: builtin,
    } satisfies Partial<ModuleBlueprint>);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: designModel(),
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Ты — продуктовый дизайнер дневников в приложении «Мая» для мам.
НЕ создавай дневники про рецепты, кулинарию и «что приготовить» — для этого уже есть каталог рецептов без записей.
Каждый дневник ОБЯЗАН иметь живой виджет (smart), а не только форму полей.
Виджет — то, с чем мама взаимодействует пальцем: таймер, шкала, вехи, серия, цель.

Верни ТОЛЬКО JSON:
{
  "title": "короткое имя",
  "description": "1 фраза",
  "icon": "spark|sport|work|study|pulse|list|growth|sleep|health|memory",
  "fields": [
    {
      "key": "snake_case",
      "label": "по-русски",
      "type": "text|number|date|select|textarea",
      "placeholder": "пример",
      "options": ["для select"],
      "required": false
    }
  ],
  "chartFieldKey": "числовое_поле_или_null",
  "smart": {
    "kind": "timer|milestones|goal|scale|streak|tips",
    "title": "заголовок виджета",
    "subtitle": "зачем",
    "timerLabel": "для timer: Занятие / Моторика / …",
    "timerUnit": "мин",
    "milestones": [{"id":"x","label":"…","hint":"…"}],
    "goalLabel": "…",
    "goalTarget": 10,
    "goalUnit": "мин",
    "goalFieldKey": "minutes",
    "scaleMinLabel": "…",
    "scaleMaxLabel": "…",
    "scaleFieldKey": "score",
    "streakLabel": "Дней подряд",
    "tips": ["…"],
    "quickAdds": [{"label":"…","prefill":"…"}]
  }
}

Выбор kind (обязательно один):
- упражнение / моторика / занятие / практика / массаж / зарядка → timer (+ поле minutes number)
- развитие / навыки / вехи → milestones (8–12 пунктов)
- настроение / самочувствие / боль → scale + score
- привычка / вода / каждый день → streak
- накопить N / лимит / цель по числу → goal
- иначе → tips, но лучше выбрать timer/scale/milestones если тема живая

Поля: 2–4 штуки. Для timer обязательно minutes (number). Без диагнозов. Только JSON.`,
        },
        {
          role: "user",
          content: titleHint
            ? `Название: ${titleHint}\nЧто вести:\n${description}`
            : `Спроектируй умный дневник с виджетом:\n${description}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<ModuleBlueprint>;
    const blueprint = normalizeBlueprint(parsed, topic);
    if (
      isRecipesCatalogTopic(topic) ||
      isRecipesCatalogModule(blueprint)
    ) {
      return Response.json({
        title: RECIPES_CATALOG_LABEL,
        description:
          "Каталог блюд — смотрите и готовьте, без записей в дневник.",
        icon: "diet",
        fields: [],
        suggestBuiltin: RECIPES_BUILTIN_SUGGEST,
      } satisfies Partial<ModuleBlueprint>);
    }
    const health = validateBlueprint(blueprint);
    return Response.json({ ...blueprint, health });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка проектирования";
    pushServerOpsError({
      source: "design",
      message,
      userSnippet: description.slice(0, 120),
    });
    return Response.json({ error: message }, { status: 500 });
  }
}
