import { buildSystemPrompt, type ClientChatPayload } from "@/lib/ai-context";
import { trackAnalyticsEvent } from "@/lib/analytics-store";
import { CHAT_TOPUP_RUB } from "@/lib/chat-quota";
import {
  getChatQuotaView,
  refundChatQuota,
  tryConsumeChatQuota,
} from "@/lib/chat-quota-store";
import {
  acquireChatSlot,
  chatBusyMessage,
} from "@/lib/chat-queue";
import { withTimeout } from "@/lib/fetch-timeout";
import { clientIpFromRequest, lookupIpGeo } from "@/lib/ip-geo";
import { chatModel, createChatOpenAI } from "@/lib/openai";
import { pushServerOpsError } from "@/lib/ops-log";
import { getServerSubscription } from "@/lib/paid-store";
import { readSessionFromRequest } from "@/lib/session";
import { PAID_ONLY, TEMP_UNLOCK_ALL } from "@/lib/subscription";
import { encodeWeatherHeader, resolveWeather } from "@/lib/weather";

export const runtime = "nodejs";

const WEATHER_BUDGET_MS = 2800;

export async function POST(req: Request) {
  const openai = createChatOpenAI();
  if (!openai) {
    const error =
      "Не настроен ключ ИИ. В .env.local нужен OPENAI_API_KEY (ключ ProxyAPI или OpenAI).";
    pushServerOpsError({ source: "server", message: error, status: 500 });
    return Response.json({ error }, { status: 500 });
  }

  const session = readSessionFromRequest(req);
  const premium =
    TEMP_UNLOCK_ALL ||
    Boolean(session?.email && getServerSubscription(session.email));

  if (!premium) {
    if (PAID_ONLY) {
      return Response.json(
        {
          error: "Чат с Маей доступен только с Premium. Оформите подписку.",
          code: "premium_required",
        },
        { status: 402 },
      );
    }
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

  let quotaKey: string | null = null;
  if (premium) {
    quotaKey = session?.email || null;
    if (!quotaKey) {
      return Response.json(
        {
          error:
            "Чтобы писать Мае по подписке, войдите в аккаунт — так считаем пакет сообщений.",
          code: "auth_required",
        },
        { status: 401 },
      );
    }
    const peek = getChatQuotaView(quotaKey);
    if (peek.remaining <= 0) {
      return Response.json(
        {
            error: `Пакет чата на месяц закончился. Доплата ${CHAT_TOPUP_RUB} ₽ — можно писать дальше.`,
            code: "chat_quota",
            quota: peek,
        },
        { status: 402 },
      );
    }
  }

  try {
    let coords = body.coords ?? null;
    const hasCoords =
      coords &&
      Number.isFinite(coords.latitude) &&
      Number.isFinite(coords.longitude);
    if (!hasCoords && !body.profile?.city?.trim()) {
      const ipGeo = await withTimeout(
        lookupIpGeo(clientIpFromRequest(req)),
        2000,
        null,
      );
      if (ipGeo) {
        coords = { latitude: ipGeo.latitude, longitude: ipGeo.longitude };
      }
    }

    const resolved = await withTimeout(
      resolveWeather({
        city: body.profile?.city,
        coords,
      }),
      WEATHER_BUDGET_MS,
      {
        weather: null,
        vpnSuspect: false,
        source: "none" as const,
        needCity: !body.profile?.city?.trim(),
      },
    );
    const weather = resolved.weather;

    const system = buildSystemPrompt({
      profile: body.profile,
      enabledModules: body.enabledModules ?? [],
      customModules: body.customModules ?? [],
      wardrobe: body.wardrobe ?? [],
      journals: body.journals ?? ({} as ClientChatPayload["journals"]),
      weather,
      pregnancy: body.pregnancy ?? null,
    });

    const slot = await acquireChatSlot();
    if (!slot.ok) {
      const error = chatBusyMessage(slot.reason);
      pushServerOpsError({
        source: "chat",
        message: `chat_busy:${slot.reason}`,
        status: 503,
        detail: `a${slot.snapshot.active}/w${slot.snapshot.waiting}`,
      });
      return Response.json(
        {
          error,
          code: "chat_busy",
          reason: slot.reason,
          queue: slot.snapshot,
        },
        { status: 503 },
      );
    }
    const { lease } = slot;

    let charged = false;
    let quotaHeaders: Record<string, string> = {};

    try {
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
        temperature: 0.65,
        max_tokens: 1800,
      });

      // Списываем только после того, как провайдер принял запрос
      if (premium && quotaKey) {
        const consumed = tryConsumeChatQuota(quotaKey);
        if (!consumed.ok) {
          lease.release();
          return Response.json(
            {
              error: `Пакет чата на месяц закончился. Доплата ${CHAT_TOPUP_RUB} ₽ — можно писать дальше.`,
              code: "chat_quota",
              quota: consumed.view,
            },
            { status: 402 },
          );
        }
        charged = true;
        quotaHeaders = {
          "X-Maya-Chat-Remaining": String(consumed.view.remaining),
          "X-Maya-Chat-Allowance": String(consumed.view.allowance),
        };
      }

      trackAnalyticsEvent({
        name: "chat_send",
        meta: lastUser?.content?.slice(0, 40),
      });

      const encoder = new TextEncoder();
      let released = false;
      let sentBytes = 0;
      const touchTimer = setInterval(() => lease.touch(), 45_000);

      const releaseOnce = () => {
        clearInterval(touchTimer);
        if (released) return;
        released = true;
        lease.release();
      };

      const maybeRefund = () => {
        if (charged && sentBytes === 0 && quotaKey) {
          try {
            refundChatQuota(quotaKey);
          } catch {
            /* ignore */
          }
        }
      };

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta?.content;
              if (!delta) continue;
              sentBytes += delta.length;
              controller.enqueue(encoder.encode(delta));
            }
            if (sentBytes === 0) maybeRefund();
            controller.close();
          } catch (err) {
            maybeRefund();
            const message =
              err instanceof Error ? err.message : "Ошибка потока ответа";
            pushServerOpsError({
              source: "chat",
              message,
              userSnippet: lastUser?.content?.slice(0, 120),
              detail: "stream",
            });
            controller.error(err);
          } finally {
            releaseOnce();
          }
        },
        cancel() {
          maybeRefund();
          releaseOnce();
        },
      });

      const headers: Record<string, string> = {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        ...quotaHeaders,
      };
      if (lease.fromQueue) {
        headers["X-Maya-Queue-Wait-Ms"] = String(lease.waitedMs);
      }
      const expose = [
        "X-Maya-Weather",
        "X-Maya-Vpn-Suspect",
        "X-Maya-Chat-Remaining",
        "X-Maya-Chat-Allowance",
        "X-Maya-Queue-Wait-Ms",
      ];
      if (weather) {
        headers["X-Maya-Weather"] = encodeWeatherHeader(weather);
      }
      if (resolved.vpnSuspect) {
        headers["X-Maya-Vpn-Suspect"] = "1";
      }
      headers["Access-Control-Expose-Headers"] = expose.join(", ");

      return new Response(readable, { headers });
    } catch (e) {
      lease.release();
      if (charged && quotaKey) {
        try {
          refundChatQuota(quotaKey);
        } catch {
          /* ignore */
        }
      }
      throw e;
    }
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
