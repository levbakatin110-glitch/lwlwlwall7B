import { createOpenAI, visionModel } from "@/lib/openai";
import type { ClothingAnalysis } from "@/lib/types";

export const runtime = "nodejs";

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
  let labelImageData = "";
  let userHint = "";
  try {
    const body = (await req.json()) as {
      imageData?: string;
      labelImageData?: string;
      userHint?: string;
    };
    imageData = body.imageData ?? "";
    labelImageData = body.labelImageData ?? "";
    userHint = String(body.userHint || "").trim();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (!imageData.startsWith("data:image/")) {
    return Response.json({ error: "Нужно фото одежды" }, { status: 400 });
  }

  const hasLabel = labelImageData.startsWith("data:image/");

  try {
    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [
      {
        type: "text",
        text: [
          "Первое изображение — фото одежды.",
          hasLabel
            ? "Второе изображение — фото бирки/ярлыка. Используй текст и состав с бирки для более точного материала, сезонности и температурного диапазона."
            : "Бирки нет — оцени только по внешнему виду (примерный диапазон температур).",
          userHint
            ? `Комментарий мамы (ПРИОРИТЕТ над твоей оценкой температуры, если в нём указан диапазон °C): «${userHint}»`
            : "",
          "Заполни JSON по правилам.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        type: "image_url",
        image_url: { url: imageData },
      },
    ];

    if (hasLabel) {
      userContent.push({
        type: "image_url",
        image_url: { url: labelImageData },
      });
    }

    const completion = await openai.chat.completions.create({
      model: visionModel(),
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Ты помощник по детской одежде в приложении «Мая». Верни JSON:
{
  "name": "краткое название на русском",
  "type": "один из: одежда | верхняя | обувь | аксессуар",
  "season": "один из: лето | демисезон | зима | всесезон",
  "tempMinC": число — мин. комфортная температура воздуха °C,
  "tempMaxC": число — макс. комфортная температура °C,
  "tempFromUser": true/false — true, если температура взята из комментария мамы или явно с бирки/карточки по словам мамы,
  "weatherTags": массив из: "солнце","дождь","ветер","снег","слякоть",
  "aiDescription": "1-2 предложения: материал/слойность и для какой погоды"
}
Правила:
- Если мама в комментарии указала температуры, нюансы («только с конвертом», «поверх флиса», «маломерит», «до +5») — это ПРИОРИТЕТ над оценкой по фото. tempFromUser=true, если температура взята из комментария.
- Понимай свободный человеческий текст, не только формат «от X до Y».
- Если есть бирка — точнее читай состав и рекомендации производителя.
- Без бирки и без комментария — осторожная примерная оценка, tempFromUser=false.
Только JSON.`,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<ClothingAnalysis> & {
      tempFromUser?: boolean;
    };

    const analysis: ClothingAnalysis & { tempFromUser?: boolean } = {
      name: String(parsed.name || "Вещь из гардероба"),
      type: String(parsed.type || "одежда"),
      season: String(parsed.season || "всесезон"),
      tempMinC: Number.isFinite(Number(parsed.tempMinC))
        ? Number(parsed.tempMinC)
        : 10,
      tempMaxC: Number.isFinite(Number(parsed.tempMaxC))
        ? Number(parsed.tempMaxC)
        : 25,
      weatherTags: Array.isArray(parsed.weatherTags)
        ? parsed.weatherTags.map(String)
        : [],
      aiDescription: String(parsed.aiDescription || ""),
      tempFromUser: Boolean(parsed.tempFromUser),
    };

    if (analysis.tempMinC > analysis.tempMaxC) {
      const t = analysis.tempMinC;
      analysis.tempMinC = analysis.tempMaxC;
      analysis.tempMaxC = t;
    }

    // Клиентский подстраховщик: вытащить °C из комментария мамы
    if (userHint) {
      const fromHint = parseTempRangeFromText(userHint);
      if (fromHint) {
        analysis.tempMinC = fromHint.min;
        analysis.tempMaxC = fromHint.max;
        analysis.tempFromUser = true;
      }
    }

    return Response.json(analysis);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка анализа";
    return Response.json({ error: message }, { status: 500 });
  }
}

function parseTempRangeFromText(text: string): { min: number; max: number } | null {
  const m = text.match(
    /(?:от\s*)?[+\-−]?\s*(\d+(?:[.,]\d+)?)\s*(?:°\s*[cс]|с)?\s*(?:до|[–\-—…]+)\s*[+\-−]?\s*(\d+(?:[.,]\d+)?)/i,
  );
  if (!m) return null;
  let min = Number(m[1].replace(",", "."));
  let max = Number(m[2].replace(",", "."));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min > max) [min, max] = [max, min];
  return { min, max };
}
