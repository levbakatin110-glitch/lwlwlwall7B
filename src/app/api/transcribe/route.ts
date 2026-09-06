import { createOpenAI, transcribeModel } from "@/lib/openai";
import { requirePaidSession } from "@/lib/require-paid-session";

export const runtime = "nodejs";

const MAX_BYTES = 3_000_000;

export async function POST(req: Request) {
  const gate = requirePaidSession(req);
  if (!gate.ok) return gate.response;

  const openai = createOpenAI();
  if (!openai) {
    return Response.json({ error: "Распознавание сейчас недоступно" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size < 800) {
    return Response.json({ error: "Пустая запись — скажите ещё раз" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Слишком длинно — скажите короче" }, { status: 400 });
  }

  try {
    const out = await openai.audio.transcriptions.create({
      file,
      model: transcribeModel(),
      language: "ru",
    });
    const text = (out.text || "").trim();
    return Response.json({ ok: true, text });
  } catch (err) {
    console.error("[transcribe]", err instanceof Error ? err.message : err);
    return Response.json(
      { error: "Не разобрала речь. Попробуйте ещё раз или напишите." },
      { status: 502 },
    );
  }
}
