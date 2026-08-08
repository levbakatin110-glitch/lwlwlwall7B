import { createOpenAI, visionModel } from "@/lib/openai";
import type { MemoryStory } from "@/lib/types";

export const runtime = "nodejs";

type IncomingMemory = {
  id: string;
  date: string;
  text: string;
  /** data URL — опционально, смотрим первые кадры */
  photoUrl?: string;
};

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced?.[1] ?? raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Нет JSON в ответе");
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(req: Request) {
  const openai = createOpenAI();
  if (!openai) {
    return Response.json(
      { error: "Не настроен ключ ИИ. Добавьте OPENAI_API_KEY в .env.local." },
      { status: 500 },
    );
  }

  let memories: IncomingMemory[] = [];
  let babyName = "малыш";
  let birthDate = "";
  try {
    const body = (await req.json()) as {
      memories?: IncomingMemory[];
      babyName?: string;
      birthDate?: string;
    };
    memories = Array.isArray(body.memories) ? body.memories : [];
    babyName = String(body.babyName || "").trim() || "малыш";
    birthDate = String(body.birthDate || "").trim();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (memories.length < 2) {
    return Response.json(
      { error: "Нужно хотя бы 2 момента — тогда можно собрать историю." },
      { status: 400 },
    );
  }

  const sorted = [...memories]
    .filter((m) => m.id && m.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 24);

  if (sorted.length < 2) {
    return Response.json({ error: "Мало валидных моментов" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const catalog = sorted
    .map(
      (m, i) =>
        `${i + 1}. id=${m.id} | дата=${m.date} | текст=${m.text?.trim() || "(без подписи)"} | фото=${
          m.photoUrl?.startsWith("data:image/") ? "есть" : "нет"
        }`,
    )
    .join("\n");

  const withPhotos = sorted.filter((m) => m.photoUrl?.startsWith("data:image/"));
  const photoPick =
    withPhotos.length <= 6
      ? withPhotos
      : [
          withPhotos[0],
          ...withPhotos
            .slice(1, -1)
            .filter((_, i, arr) => i % Math.ceil(arr.length / 4) === 0)
            .slice(0, 4),
          withPhotos[withPhotos.length - 1],
        ].filter(Boolean);

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: [
        `Собери одно тёплое «фильм-воспоминание» про ребёнка «${babyName}».`,
        birthDate ? `Дата рождения: ${birthDate}.` : "",
        `Сегодня: ${today}.`,
        "Моменты уже отсортированы по дате (от старых к новым). Это кадры одной истории.",
        "Сделай монтаж словами: свяжи кадры во времени («месяц назад», «неделю назад», «вчера»).",
        "Тон: как мама рассказывает близким, без пафоса и без медицинских советов.",
        "Используй ТОЛЬКО id из списка. Порядок scenes — хронологический.",
        "",
        "Каталог моментов:",
        catalog,
        "",
        "Верни ТОЛЬКО JSON:",
        `{
  "title": "короткий заголовок фильма",
  "subtitle": "одна строка",
  "intro": "2-3 предложения-завязка",
  "scenes": [
    {
      "memoryId": "точный id",
      "whenLabel": "Месяц назад / На прошлой неделе / …",
      "headline": "3-6 слов",
      "line": "1-2 предложения про этот кадр в истории"
    }
  ],
  "outro": "тёплое закрытие на 1-2 предложения"
}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  for (const m of photoPick) {
    if (!m.photoUrl) continue;
    userContent.push({
      type: "text",
      text: `Фото момента id=${m.id} (${m.date}): ${m.text || "без подписи"}`,
    });
    userContent.push({
      type: "image_url",
      image_url: { url: m.photoUrl },
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: visionModel(),
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "Ты режиссёр семейных воспоминаний для мам. Собираешь хронологический монтаж из моментов. Отвечаешь только валидным JSON.",
        },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "";
    const parsed = extractJson(raw) as {
      title?: string;
      subtitle?: string;
      intro?: string;
      scenes?: {
        memoryId?: string;
        whenLabel?: string;
        headline?: string;
        line?: string;
      }[];
      outro?: string;
    };

    const idSet = new Set(sorted.map((m) => m.id));
    const scenes = (parsed.scenes || [])
      .map((s) => ({
        memoryId: String(s.memoryId || "").trim(),
        whenLabel: String(s.whenLabel || "").trim() || "Тогда",
        headline: String(s.headline || "").trim() || "Момент",
        line: String(s.line || "").trim(),
      }))
      .filter((s) => idSet.has(s.memoryId) && s.line);

    // Если модель пропустила кадры — добьём по порядку
    const used = new Set(scenes.map((s) => s.memoryId));
    for (const m of sorted) {
      if (used.has(m.id)) continue;
      scenes.push({
        memoryId: m.id,
        whenLabel: m.date,
        headline: m.text?.slice(0, 40) || "Момент",
        line: m.text || "Важный кадр в вашей истории.",
      });
    }

    scenes.sort((a, b) => {
      const da = sorted.find((m) => m.id === a.memoryId)?.date || "";
      const db = sorted.find((m) => m.id === b.memoryId)?.date || "";
      return da.localeCompare(db);
    });

    const story: MemoryStory = {
      title: String(parsed.title || "").trim() || `История ${babyName}`,
      subtitle:
        String(parsed.subtitle || "").trim() ||
        "Собрано Маей из ваших моментов",
      intro:
        String(parsed.intro || "").trim() ||
        "Вот как складывались дни — кадр за кадром.",
      scenes,
      outro:
        String(parsed.outro || "").trim() ||
        "Пусть таких дней будет ещё много.",
      createdAt: new Date().toISOString(),
    };

    return Response.json(story);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка ИИ";
    return Response.json({ error: message }, { status: 500 });
  }
}
