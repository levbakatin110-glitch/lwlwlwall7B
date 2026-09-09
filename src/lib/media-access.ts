/** Доступ к камере/микрофону: iOS рвёт getUserMedia, если вызвать не из того же нажатия. */

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(
      (navigator as Navigator & { standalone?: boolean }).standalone,
    )
  );
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /FBAN|FBAV|Instagram|Line\/|VKAndroid|GSA\//i.test(ua);
}

function errorName(err: unknown): string {
  if (err && typeof err === "object" && "name" in err) {
    return String((err as { name: string }).name);
  }
  return "";
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message || "");
  }
  return "";
}

export function describeMediaError(err: unknown): string {
  const name = errorName(err);
  const message = errorMessage(err);
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Камера и микрофон работают только на https.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Камера или микрофон не найдены.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "Камера занята другим приложением. Закройте его и нажмите ещё раз.";
  }
  if (isInAppBrowser()) {
    return "Внутри Telegram или Instagram камера не работает. Откройте hey-maya.ru в Safari.";
  }
  if (isStandaloneDisplay()) {
    return "Разрешение в меню Safari на сайт не действует на иконку с экрана. Настройки iPhone → Майя → Камера и Микрофон → Разрешить, затем нажмите ещё раз.";
  }
  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError" ||
    /permissions? policy|feature policy/i.test(message)
  ) {
    return "В меню страницы Safari этого мало. Настройки iPhone → Safari → Камера и Микрофон — «Спрашивать» или «Разрешить», затем нажмите ещё раз.";
  }
  if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
    return "Этот браузер не даёт камеру. Откройте сайт в Safari.";
  }
  return "Нажмите «Разрешить» ещё раз. Если в меню сайта уже стоит «Разрешить» — откройте Настройки iPhone → Safari → Камера и Микрофон.";
}

export async function getMicStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("no-media");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  }
}
