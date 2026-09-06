/** Старый JS после деплоя: браузер просит чанк, которого уже нет. */

const STALE_MARK =
  /ChunkLoadError|CSS_CHUNK_LOAD_FAILED|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Loading CSS chunk/i;

const NET_FAIL =
  /Failed to fetch|Load failed|NetworkError when attempting to fetch|Не удалось получить|Ошибка загрузки/i;

const NEXT_CHUNK = /\/_next\/static\/|static\/chunks\//i;

export function isStaleChunkText(text: string): boolean {
  const t = text || "";
  if (STALE_MARK.test(t)) return true;
  return NET_FAIL.test(t) && NEXT_CHUNK.test(t);
}

export function isStaleChunkError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error) {
    return isStaleChunkText(
      `${error.name} ${error.message} ${error.stack ?? ""}`,
    );
  }
  return isStaleChunkText(String(error));
}

/** Sentry: смотрим текст ошибки и culprit, не весь стек (там всегда чанки Next). */
export function isStaleChunkSentryEvent(
  message: string,
  culprit: string,
): boolean {
  if (isStaleChunkText(message)) return true;
  return NET_FAIL.test(message) && NEXT_CHUNK.test(culprit);
}
