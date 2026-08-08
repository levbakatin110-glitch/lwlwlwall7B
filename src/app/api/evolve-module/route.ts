import { designModel, createOpenAI } from "@/lib/openai";
import { validateBlueprint } from "@/lib/blueprint-health";
import { normalizeBlueprint } from "@/lib/module-schema";
import { pushServerOpsError } from "@/lib/ops-log";
import type { CustomModule, ModuleBlueprint } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const openai = createOpenAI();
  if (!openai) {
    return Response.json(
      { error: "Не настроен ключ ИИ. Добавьте OPENAI_API_KEY в .env.local." },
      { status: 500 },
    );
  }

  let instruction = "";
  let module: CustomModule | null = null;
  try {
    const body = (await req.json()) as {
      instruction?: string;
      module?: CustomModule;
    };
    instruction = String(body.instruction || "").trim();
    module = body.module ?? null;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (!module?.id || instruction.length < 2) {
    return Response.json({ error: "Нужны модуль и инструкция" }, { status: 400 });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: designModel(),
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Ты эволюционируешь умный дневник «Мая». Сохрани или улучши smart-виджет.
Верни полную схему JSON:
{
  "title": "...",
  "description": "...",
  "icon": "spark|sport|work|study|pulse|list|growth|sleep|health|memory",
  "fields": [ { "key", "label", "type", "placeholder?", "options?", "required?" } ],
  "chartFieldKey": "key или null",
  "smart": { "kind": "timer|milestones|goal|scale|streak|tips", "title": "...", "subtitle?": "...", "...": "по kind" },
  "changeSummary": "1 предложение что изменилось"
}

Правила:
- type: text|number|date|select|textarea
- Сохраняй key существующих полей, если поле только переименовали по смыслу.
- Новый key — только для действительно новых полей (латиница snake_case).
- Если просят удалить поле — не включай его в fields.
- Если просят график по конкретному показателю — поставь chartFieldKey на нужное number-поле.
- Обязателен smart. 2–8 полей. Только JSON.`,
        },
        {
          role: "user",
          content: `Текущий модуль:\n${JSON.stringify(
            {
              title: module.title,
              description: module.description,
              icon: module.icon,
              fields: module.fields,
              chartFieldKey: module.chartFieldKey,
              smart: module.smart,
            },
            null,
            2,
          )}\n\nИнструкция пользователя:\n${instruction}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<ModuleBlueprint> & {
      changeSummary?: string;
    };
    const blueprint = normalizeBlueprint(parsed);
    return Response.json({
      blueprint,
      changeSummary: String(parsed.changeSummary || "Модуль обновлён"),
      health: validateBlueprint(blueprint),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка изменения модуля";
    pushServerOpsError({ source: "evolve", message });
    return Response.json({ error: message }, { status: 500 });
  }
}
