import { designModel, createOpenAI } from "@/lib/openai";
import {
  needsAiRepair,
  repairBlueprintLocally,
  validateBlueprint,
  validateCustomModule,
} from "@/lib/blueprint-health";
import { pushServerOpsError } from "@/lib/ops-log";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeBlueprint } from "@/lib/module-schema";
import type { CustomModule, ModuleBlueprint } from "@/lib/types";

export const runtime = "nodejs";

/** Чинит битый свой дневник: сначала локально, при необходимости — ИИ */
export async function POST(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Нет доступа" }, { status: 401 });
  }

  let module: CustomModule | null = null;
  let forceAi = false;
  try {
    const body = (await req.json()) as {
      module?: CustomModule;
      forceAi?: boolean;
    };
    module = body.module ?? null;
    forceAi = Boolean(body.forceAi);
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (!module?.id) {
    return Response.json({ error: "Нужен модуль" }, { status: 400 });
  }

  const before = validateCustomModule(module);
  let blueprint: ModuleBlueprint = repairBlueprintLocally(module);
  let after = validateBlueprint(blueprint);
  let mode: "local" | "ai" = "local";
  let changeSummary = "Подправила схему и виджет локально.";

  const stillBroken = needsAiRepair(after) || forceAi;

  if (stillBroken) {
    const openai = createOpenAI();
    if (!openai) {
      pushServerOpsError({
        source: "repair",
        message: "Нет ключа ИИ для починки дневника",
        detail: module.title,
      });
      return Response.json({
        blueprint,
        before,
        after,
        mode,
        changeSummary:
          changeSummary +
          " Полная починка через ИИ недоступна (нет ключа) — примените локальный вариант.",
        aiSkipped: true,
      });
    }

    try {
      const completion = await openai.chat.completions.create({
        model: designModel(),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Ты чинишь битый дневник «Мая». Сохрани смысл и key полей, где возможно.
Верни полный JSON ModuleBlueprint:
{
  "title": "...",
  "description": "...",
  "icon": "spark|sport|work|study|pulse|list|growth|sleep|health|memory",
  "fields": [{ "key","label","type","placeholder?","options?","required?" }],
  "chartFieldKey": "key или null",
  "smart": { "kind":"timer|milestones|goal|scale|streak|tips", "title":"...", "...":"по kind" },
  "changeSummary": "что починила"
}
Обязателен рабочий smart. Для milestones — 6–12 пунктов. Для timer — поле minutes. Только JSON.`,
          },
          {
            role: "user",
            content: `Проблемы:\n${before.issues.map((i) => `- [${i.severity}] ${i.message}`).join("\n") || "нет списка"}\n\nМодуль:\n${JSON.stringify(
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
            )}`,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as Partial<ModuleBlueprint> & {
        changeSummary?: string;
      };
      blueprint = normalizeBlueprint(
        parsed,
        `${module.title} ${module.description}`,
      );
      after = validateBlueprint(blueprint);
      mode = "ai";
      changeSummary = String(
        parsed.changeSummary || "Починила дневник через ИИ.",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка починки";
      pushServerOpsError({
        source: "repair",
        message,
        detail: module.title,
      });
      return Response.json({
        blueprint,
        before,
        after,
        mode: "local",
        changeSummary: `ИИ не ответила (${message}). Применён локальный ремонт.`,
        aiError: message,
      });
    }
  }

  return Response.json({
    blueprint,
    before,
    after,
    mode,
    changeSummary,
  });
}
