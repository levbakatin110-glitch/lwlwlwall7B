import { createOpenAI, visionModel } from "@/lib/openai";

export const runtime = "nodejs";

export type MedicalScanResult = {
  title: string;
  summary: string;
  value: string;
  note: string;
  kind: "lab" | "document" | "other";
};

export async function POST(req: Request) {
  const openai = createOpenAI();
  if (!openai) {
    return Response.json(
      {
        error:
          "Не настроен ключ ИИ. Добавьте OPENAI_API_KEY в файл .env.local.",
      },
      { status: 500 },
    );
  }

  let imageData = "";
  let hint = "";
  try {
    const body = (await req.json()) as { imageData?: string; hint?: string };
    imageData = body.imageData ?? "";
    hint = String(body.hint || "").trim();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (!imageData.startsWith("data:image/")) {
    return Response.json({ error: "Нужно фото документа или анализа" }, { status: 400 });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: visionModel(),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Ты помогаешь маме разобрать фото анализа/документа (ОАК, УЗИ, направление, обменка).
Верни ТОЛЬКО JSON:
{"title":"короткое название","summary":"2–4 предложения по-русски простым языком","value":"одна строка для дневника","note":"ключевые цифры или даты","kind":"lab"|"document"|"other"}
Не ставь диагнозов. Если нечитаемо — скажи об этом в summary. Это не замена врачу.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: hint
                ? `Комментарий мамы: ${hint}`
                : "Распознай текст на фото и кратко объясни, что это.",
            },
            { type: "image_url", image_url: { url: imageData } },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw) as Partial<MedicalScanResult>;
    const result: MedicalScanResult = {
      title: String(parsed.title || "Документ").slice(0, 80),
      summary: String(parsed.summary || "").slice(0, 800),
      value: String(parsed.value || parsed.title || "Запись из фото").slice(0, 200),
      note: String(parsed.note || "").slice(0, 400),
      kind:
        parsed.kind === "lab" || parsed.kind === "document"
          ? parsed.kind
          : "other",
    };
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка распознавания";
    return Response.json({ error: msg }, { status: 500 });
  }
}
