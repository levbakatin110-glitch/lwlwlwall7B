import { createOpenAI, visionModel } from "@/lib/openai";
import { applyLabInterpretation } from "@/lib/lab-interpret";
import { requirePaidSession } from "@/lib/require-paid-session";

export const runtime = "nodejs";

export type MedicalScanResult = {
  title: string;
  summary: string;
  value: string;
  note: string;
  kind: "lab" | "document" | "other";
};

const MAX_IMAGE_CHARS = 1_800_000; // ~1.3MB base64

export async function POST(req: Request) {
  const gate = requirePaidSession(req);
  if (!gate.ok) return gate.response;

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
  let kindHint: "lab" | "document" | undefined;
  try {
    const body = (await req.json()) as {
      imageData?: string;
      hint?: string;
      kind?: string;
    };
    imageData = body.imageData ?? "";
    hint = String(body.hint || "").trim();
    if (body.kind === "lab" || body.kind === "document") kindHint = body.kind;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (!imageData.startsWith("data:image/")) {
    return Response.json(
      { error: "Нужно фото документа или анализа" },
      { status: 400 },
    );
  }
  if (imageData.length > MAX_IMAGE_CHARS) {
    return Response.json(
      { error: "Фото слишком большое, сделайте ближе или сожмите" },
      { status: 413 },
    );
  }

  const focus =
    kindHint === "lab"
      ? "Это анализ (ОАК, биохимия, УЗИ и т.п.), выдели ключевые цифры."
      : kindHint === "document"
        ? "Это медицинский документ (направление, обменка), даты, врач, суть."
        : "Определи, анализ это или документ.";

  try {
    const completion = await openai.chat.completions.create({
      model: visionModel(),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Ты помогаешь маме разобрать фото анализа/документа (ОАК, биохимия, УЗИ, направление, обменка).
${focus}
Верни ТОЛЬКО JSON:
{"title":"короткое название","summary":"2–4 предложения простым языком","value":"одна строка для дневника","note":"ключевые цифры или даты","kind":"lab"|"document"|"other","markers":[{"name":"гемоглобин","value":108,"unit":"г/л"}]}
Цифры копируй с фото как есть. В markers — все читаемые показатели (гемоглобин, ферритин, лейкоциты, тромбоциты, глюкоза и т.п.).
Не пиши слова «анемия», «диагноз», «патология», «всё нормально», «всё в норме». Не оценивай «хорошо/плохо». Это не замена врачу. Если нечитаемо — скажи об этом в summary.`,
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
    const parsed = JSON.parse(raw) as Partial<MedicalScanResult> & {
      markers?: unknown;
    };
    const interpreted = applyLabInterpretation({
      title: String(parsed.title || "Документ").slice(0, 80),
      summary: String(parsed.summary || "").slice(0, 800),
      value: String(parsed.value || parsed.title || "Запись из фото").slice(
        0,
        200,
      ),
      note: String(parsed.note || "").slice(0, 400),
      markers: Array.isArray(parsed.markers) ? parsed.markers : [],
    });
    const result: MedicalScanResult = {
      title: interpreted.title,
      summary: interpreted.summary,
      value: interpreted.value,
      note: interpreted.note,
      kind:
        parsed.kind === "lab" || parsed.kind === "document"
          ? parsed.kind
          : kindHint || "other",
    };
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка распознавания";
    return Response.json({ error: msg }, { status: 500 });
  }
}
