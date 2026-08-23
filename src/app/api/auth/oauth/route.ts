import {
  createOAuthState,
  googleAuthUrl,
  providerConfigured,
  providersStatus,
  safeReturnTo,
  yandexAuthUrl,
  type OAuthProvider,
} from "@/lib/oauth";

export const runtime = "nodejs";

function isProvider(v: string): v is OAuthProvider {
  return v === "google" || v === "yandex";
}

/** Какие соц. входы настроены на сервере */
export async function GET() {
  return Response.json(providersStatus());
}

/** Старт OAuth: /api/auth/oauth/google?mode=login&returnTo=/register */
export async function POST(req: Request) {
  let body: {
    provider?: string;
    mode?: string;
    returnTo?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const provider = String(body.provider || "");
  if (!isProvider(provider)) {
    return Response.json({ error: "Неизвестный провайдер" }, { status: 400 });
  }
  if (!providerConfigured(provider)) {
    return Response.json(
      {
        error:
          provider === "google"
            ? "Вход через Google ещё не настроен (нужны GOOGLE_CLIENT_ID / SECRET на сервере)"
            : "Вход через Яндекс ещё не настроен (нужны YANDEX_CLIENT_ID / SECRET на сервере)",
      },
      { status: 503 },
    );
  }

  const mode = body.mode === "register" ? "register" : "login";
  const returnTo = safeReturnTo(body.returnTo);
  const state = createOAuthState({ provider, mode, returnTo });
  const url =
    provider === "google" ? googleAuthUrl(state) : yandexAuthUrl(state);

  return Response.json({ url });
}
