import {
  buildAuthUrl,
  createOAuthState,
  providerConfigured,
  providersStatus,
  safeReturnTo,
  savePkceSession,
  type OAuthProvider,
} from "@/lib/oauth";

export const runtime = "nodejs";

function isProvider(v: string): v is OAuthProvider {
  return v === "mailru";
}

export async function GET() {
  return Response.json(providersStatus());
}

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
          "Вход через Mail.ru ещё не настроен (нужны MAILRU_CLIENT_ID / SECRET на сервере)",
      },
      { status: 503 },
    );
  }

  const mode = body.mode === "register" ? "register" : "login";
  const returnTo = safeReturnTo(body.returnTo);
  const { state, nonce } = createOAuthState({ provider, mode, returnTo });
  const { challenge, deviceId } = savePkceSession(nonce, provider);
  const url = buildAuthUrl(provider, state, challenge, deviceId);
  return Response.json({ url });
}
