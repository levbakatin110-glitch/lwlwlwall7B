import {
  createOAuthTicket,
  exchangeMailruCode,
  exchangeVkCode,
  parseOAuthState,
  providerConfigured,
  safeReturnTo,
  siteOrigin,
  takePkceSession,
  type OAuthProvider,
} from "@/lib/oauth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ provider: string }> };

function isProvider(v: string): v is OAuthProvider {
  return v === "vk" || v === "mailru";
}

function redirectError(returnTo: string, message: string) {
  const u = new URL(safeReturnTo(returnTo), siteOrigin());
  u.searchParams.set("oauth_error", message);
  return Response.redirect(u.toString(), 302);
}

export async function GET(req: Request, ctx: Ctx) {
  const { provider: raw } = await ctx.params;
  if (!isProvider(raw)) {
    return redirectError("/register", "Неизвестный провайдер");
  }
  if (!providerConfigured(raw)) {
    return redirectError(
      "/register",
      raw === "vk"
        ? "VK OAuth не настроен на сервере"
        : "Mail.ru OAuth не настроен на сервере",
    );
  }

  const url = new URL(req.url);
  const err = url.searchParams.get("error");
  const errDesc = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const deviceIdFromQuery = url.searchParams.get("device_id") || "";

  const parsed = parseOAuthState(state);
  const returnTo = parsed.ok ? safeReturnTo(parsed.data.r) : "/register";

  if (err) {
    return redirectError(returnTo, errDesc || err || "Вход отменён");
  }
  if (!code) {
    return redirectError(returnTo, "Нет кода авторизации");
  }
  if (!parsed.ok) {
    return redirectError(returnTo, parsed.error);
  }

  const pkce = takePkceSession(parsed.data.n, raw);
  if (!pkce.ok) {
    return redirectError(returnTo, pkce.error);
  }

  try {
    const email =
      raw === "vk"
        ? await exchangeVkCode({
            code,
            deviceId: deviceIdFromQuery || pkce.deviceId,
            verifier: pkce.verifier,
          })
        : await exchangeMailruCode({
            code,
            verifier: pkce.verifier,
          });
    const ticket = createOAuthTicket(email);
    const dest = new URL(returnTo, siteOrigin());
    dest.searchParams.set("oauth", ticket);
    dest.searchParams.set("oauth_provider", raw);
    return Response.redirect(dest.toString(), 302);
  } catch (e) {
    return redirectError(
      returnTo,
      e instanceof Error ? e.message : "Ошибка входа",
    );
  }
}
