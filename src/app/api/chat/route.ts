import { buildSystemPrompt, type ClientChatPayload } from "@/lib/ai-context";
import { clientIpFromRequest, lookupIpGeo } from "@/lib/ip-geo";
import { chatModel, createOpenAI } from "@/lib/openai";
import { pushServerOpsError } from "@/lib/ops-log";
import { encodeWeatherHeader, resolveWeather } from "@/lib/weather";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const openai = createOpenAI();
  if (!openai) {
    const error =
      "Не настроен ключ ИИ. В .env.local нужен OPENAI_API_KEY (ключ ProxyAPI или OpenAI).";
    pushServerOpsError({ source: "server", message: error, status: 500 });
    return Response.json({ error }, { status: 500 });
  }

  let body: ClientChatPayload;
  try {
    body = (await req.json()) as ClientChatPayload;
  } catch {
    pushServerOpsError({
      source: "chat",
      message: "Некорректный запрос чата",
      status: 400,
    });
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "Нет сообщений" }, { status: 400 });
  }

  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");

  try {
    let coords = body.coords ?? null;
    const hasCoords =
      coords &&
      Number.isFinite(coords.latitude) &&
      Number.isFinite(coords.longitude);
    if (!hasCoords) {
      const ipGeo = await lookupIpGeo(clientIpFromRequest(req));
      if (ipGeo) {
        coords = { latitude: ipGeo.latitude, longitude: ipGeo.longitude };
        if (!body.profile?.city?.trim() && ipGeo.city && body.profile) {
          body = {
            ...body,
            profile: { ...body.profile, city: ipGeo.city },
          };
        }
      }
    }

    const resolved = await resolveWeather({
      city: body.profile?.city,
      coords,
    });
    const weather = resolved.weather;

    const system = buildSystemPrompt({
      profile: body.profile,
      enabledModules: body.enabledModules ?? [],
      customModules: body.customModules ?? [],
      wardrobe: body.wardrobe ?? [],
      memories: body.memories ?? [],
      memoryStory: body.memoryStory ?? null,
      journals: body.journals ?? ({} as ClientChatPayload["journals"]),
      weather,
    });

    const stream = await openai.chat.completions.create({
      model: chatModel(),
      stream: true,
      messages: [
        { role: "system", content: system },
        ...body.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      temperature: 0.6,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          }
          controller.close();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Ошибка потока ответа";
          pushServerOpsError({
            source: "chat",
            message,
            userSnippet: lastUser?.content?.slice(0, 120),
            detail: "stream",
          });
          controller.error(err);
        }
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    };
    const expose = ["X-Maya-Weather", "X-Maya-Vpn-Suspect"];
    if (weather) {
      headers["X-Maya-Weather"] = encodeWeatherHeader(weather);
    }
    if (resolved.vpnSuspect) {
      headers["X-Maya-Vpn-Suspect"] = "1";
    }
    headers["Access-Control-Expose-Headers"] = expose.join(", ");

    return new Response(readable, { headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка OpenAI";
    pushServerOpsError({
      source: "chat",
      message,
      status: 500,
      userSnippet: lastUser?.content?.slice(0, 120),
    });
    return Response.json({ error: message }, { status: 500 });
  }
}
