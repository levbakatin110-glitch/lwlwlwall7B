import { newShareId, saveSharedFilm, type SharedSceneMedia } from "@/lib/share-store";
import type { MemoryStory } from "@/lib/types";

export const runtime = "nodejs";

/** Макс. размер тела — чтобы не убить диск огромными base64 */
export const maxDuration = 60;

export async function POST(req: Request) {
  let story: MemoryStory | null = null;
  let babyName = "малыш";
  let media: SharedSceneMedia[] = [];

  try {
    const body = (await req.json()) as {
      story?: MemoryStory;
      babyName?: string;
      media?: SharedSceneMedia[];
    };
    story = body.story ?? null;
    babyName = String(body.babyName || "").trim() || "малыш";
    media = Array.isArray(body.media) ? body.media.slice(0, 24) : [];
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (!story?.scenes?.length || !story.title) {
    return Response.json({ error: "Нет фильма для ссылки" }, { status: 400 });
  }

  // Оставляем только кадры из сцен; режем слишком жирные фото
  const need = new Set(story.scenes.map((s) => s.memoryId));
  const cleaned = media
    .filter((m) => need.has(m.memoryId))
    .map((m) => ({
      memoryId: m.memoryId,
      date: m.date,
      text: m.text || "",
      photoUrl:
        m.photoUrl && m.photoUrl.length < 900_000 ? m.photoUrl : undefined,
    }));

  const id = newShareId();
  try {
    await saveSharedFilm({
      id,
      createdAt: new Date().toISOString(),
      babyName,
      story: {
        ...story,
        scenes: story.scenes.slice(0, 24),
      },
      media: cleaned,
    });
  } catch {
    return Response.json(
      { error: "Не удалось сохранить ссылку на сервере" },
      { status: 500 },
    );
  }

  return Response.json({ id, path: `/s/${id}` });
}
