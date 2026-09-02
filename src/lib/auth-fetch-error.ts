/** Человекочитаемая ошибка, когда fetch до /api/auth/* не дошёл (Safari: «Load failed»). */
export function authFetchErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message.trim();
  if (!msg || /load failed|failed to fetch|networkerror|network request failed|fetch failed|aborted|timeout/i.test(msg)) {
    return "Не удалось связаться с сайтом. Отключите VPN и откройте hey-maya.ru в Safari или Chrome (не из приложения Почты).";
  }
  return msg;
}
