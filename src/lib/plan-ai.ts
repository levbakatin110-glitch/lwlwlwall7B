import { randomBytes } from "crypto";
import { join } from "path";
import type { JournalEntry } from "@/lib/types";
import { PLAN_TOPIC_LABEL, type PlanTopic } from "@/lib/plan-products";
import { createOpenAI, designModel } from "@/lib/openai";
import { writePlanPdf } from "@/lib/plan-pdf";
import {
  getOrder,
  pdfDir,
  updateOrder,
  type PlanOrder,
} from "@/lib/orders-store";

export type PlanAiResult = {
  analysis: string;
  planText: string;
  questionsForMom: string;
};

function formatEntries(entries: JournalEntry[]): string {
  if (!entries.length) return "Записей в дневнике нет.";
  return entries
    .slice(0, 60)
    .map((e, i) => {
      const when = e.createdAt
        ? `${e.date} ${e.createdAt.slice(11, 16)}`
        : e.date;
      const fields =
        e.fields && Object.keys(e.fields).length
          ? ` | поля: ${JSON.stringify(e.fields)}`
          : "";
      return `${i + 1}. [${when}] ${e.value}${e.note ? ` — ${e.note}` : ""}${fields}`;
    })
    .join("\n");
}

function systemPrompt(topic: PlanTopic): string {
  const topicRu = PLAN_TOPIC_LABEL[topic];
  return `Ты помощник сервиса «Мая» для мам. Составляешь черновики персональных планов по теме «${topicRu}» на основе дневника.

Правила:
- Опирайся ТОЛЬКО на записи дневника. Не выдумывай факты.
- Это НЕ медицинский диагноз. Не назначай лекарства. При красных флагах — направь к педиатру.
- Пиши по-русски, тепло и конкретно.
- План на 7–14 дней, с понятными шагами по дням или фазам.
- Ответ строго JSON (без markdown-обёртки) с полями:
  - analysis: разбор для команды Маи (что видно, паттерны, риски, на что обратить внимание при проверке) — 150–400 слов
  - questionsForMom: 2–3 коротких вопроса маме для уточнения (одним текстом, нумерованный список)
  - planText: готовый план для мамы (структура: «Что видно по записям», «Короткий итог», «План на неделю», «С чего начать завтра») — 400–900 слов`;
}

function userPrompt(order: PlanOrder): string {
  const entries = order.diarySnapshot?.entries ?? [];
  const child = order.childName?.trim() || "малыш";
  return `Тема: ${PLAN_TOPIC_LABEL[order.topic]}
Имя малыша: ${child}
Записей в дневнике: ${entries.length}

Записи:
${formatEntries(entries)}`;
}

async function callPlanAi(order: PlanOrder): Promise<PlanAiResult> {
  const openai = createOpenAI();
  if (!openai) {
    throw new Error("OPENAI_API_KEY не настроен");
  }

  const res = await openai.chat.completions.create({
    model: designModel(),
    temperature: 0.45,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt(order.topic) },
      { role: "user", content: userPrompt(order) },
    ],
  });

  const raw = res.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error("Пустой ответ ИИ");

  let parsed: {
    analysis?: string;
    planText?: string;
    questionsForMom?: string;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("ИИ вернул не JSON");
  }

  const analysis = parsed.analysis?.trim();
  const planText = parsed.planText?.trim();
  if (!analysis || !planText) {
    throw new Error("В ответе ИИ нет analysis или planText");
  }

  return {
    analysis,
    planText,
    questionsForMom: parsed.questionsForMom?.trim() || "",
  };
}

/** Генерация разбора + черновика PDF для заказа */
export async function generatePlanAiDraft(orderId: string): Promise<PlanOrder | null> {
  const order = getOrder(orderId);
  if (!order) return null;

  updateOrder(orderId, {
    aiDraft: {
      ...order.aiDraft,
      status: "pending",
      error: undefined,
    },
  });

  try {
    const result = await callPlanAi(order);
    const pdfName = `ai-draft-${orderId.slice(-10)}-${randomBytes(3).toString("hex")}.pdf`;
    const pdfPath = join(pdfDir(), pdfName);

    await writePlanPdf({
      outPath: pdfPath,
      topic: order.topic,
      childName: order.childName,
      planText: result.planText,
    });

    const analysisBlock = result.questionsForMom
      ? `${result.analysis}\n\n---\nВопросы маме:\n${result.questionsForMom}`
      : result.analysis;

    return updateOrder(orderId, {
      aiDraft: {
        analysis: analysisBlock,
        planText: result.planText,
        pdfFile: pdfName,
        generatedAt: new Date().toISOString(),
        status: "ready",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка ИИ";
    console.error("[plan-ai]", orderId, e);
    return updateOrder(orderId, {
      aiDraft: {
        ...order.aiDraft,
        status: "error",
        error: msg,
        generatedAt: new Date().toISOString(),
      },
    });
  }
}

export function schedulePlanAiDraft(orderId: string) {
  void generatePlanAiDraft(orderId).catch((e) =>
    console.error("[plan-ai] schedule failed", orderId, e),
  );
}
