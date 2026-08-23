import {
  createOAuthTicket,
  exchangeGoogleCode,
  exchangeYandexCode,
  parseOAuthState,
  providerConfigured,
  safeReturnTo,
  siteOrigin,
  type OAuthProvider,
} from "@/lib/oauth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ provider: string }> };

function isProvider(v: string): v is OAuthProvider {
  return v === "google" || v === "yandex";
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
      raw === "google"
        ? "Google OAuth не настроен на сервере"
        : "Яндекс OAuth не настроен на сервере",
    );
  }

  const url = new URL(req.url);
  const err = url.searchParams.get("error");
  const errDesc = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";

  const parsed = parseOAuthState(state);
  const returnTo = parsed.ok ? safeReturnTo(parsed.data.r) : "/register";

  if (err) {
    return redirectError(
      returnTo,
      errDesc || err || "Вход отменён",
    );
  }
  if (!code) {
    return redirectError(returnTo, "Нет кода авторизации");
  }
  if (!parsed.ok) {
    return redirectError(returnTo, parsed.error);
  }

  try {
    const email =
      raw === "google"
        ? await exchangeGoogleCode(code)
        : await exchangeYandexCode(code);
    const ticket = createOAuthTicket(email);
    const dest = new URL(returnTo, siteOrigin());
    dest.searchParams.set("oauth", ticket);
    dest.searchParams.set(
      "oauth_provider",
      raw === "google" ? "google" : "yandex",
    );
    return Response.redirect(dest.toString(), 302);
  } catch (e) {
    return redirectError(
      returnTo,
      e instanceof Error ? e.message : "Ошибка входа",
    );
  }
}
