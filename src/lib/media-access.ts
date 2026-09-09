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

export function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
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

function isPermissionDenied(err: unknown): boolean {
  const name = errorName(err);
  const message = errorMessage(err);
  return (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError" ||
    /permissions? policy|feature policy/i.test(message)
  );
}

/** Пошаговая подсказка, если камера/мик закрыты настройками телефона. */
export function describeMediaPermissionHelp(): string {
  if (isInAppBrowser()) {
    return isAndroid()
      ? "Внутри Telegram или Instagram камера не работает.\nОткройте hey-maya.ru в Chrome и нажмите «Разрешить камеру»."
      : "Внутри Telegram или Instagram камера не работает.\nОткройте hey-maya.ru в Safari и нажмите «Разрешить камеру».";
  }

  if (isStandaloneDisplay()) {
    if (isAndroid()) {
      return [
        "Приложение с главного экрана берёт разрешения из настроек телефона, не из браузера.",
        "",
        "1. Настройки → Приложения → Майя (или Chrome)",
        "2. Разрешения → Камера → Разрешить",
        "3. Микрофон → Разрешить",
        "4. Вернитесь сюда и нажмите «Разрешить камеру»",
      ].join("\n");
    }
    return [
      "Важно: разрешение на сайт в Safari не действует на иконку «Майя» с экрана Домой. Их нужно включить отдельно.",
      "",
      "1. Откройте Настройки iPhone",
      "2. Пролистайте вниз до «Майя» (или Maya)",
      "3. Камера → Разрешить",
      "4. Микрофон → Разрешить",
      "5. Вернитесь сюда и нажмите «Разрешить камеру»",
    ].join("\n");
  }

  if (isAndroid()) {
    return [
      "Нужно разрешение камеры и микрофона.",
      "",
      "1. Нажмите «Разрешить камеру» и в окне телефона — «Разрешить»",
      "2. Если окна нет или раньше нажали «Запретить»:",
      "   замочек слева от адреса сайта → Разрешения → Камера и Микрофон → Разрешить",
      "   или меню ⋮ → Настройки сайта → Камера / Микрофон",
      "3. Вернитесь и нажмите «Разрешить камеру» ещё раз",
    ].join("\n");
  }

  if (isAppleMobile()) {
    return [
      "Нужно разрешение камеры и микрофона в Safari.",
      "",
      "1. Нажмите «Разрешить камеру» и в окне — «Разрешить»",
      "2. Если окна нет или раньше нажали «Запретить»:",
      "   Настройки iPhone → Safari → Камера → «Спрашивать» или «Разрешить»",
      "   То же для пункта «Микрофон»",
      "3. Вернитесь и нажмите «Разрешить камеру» ещё раз",
    ].join("\n");
  }

  return [
    "Нужно разрешение камеры и микрофона.",
    "",
    "1. Нажмите «Разрешить камеру» и разрешите доступ во всплывающем окне",
    "2. Если раньше запретили — откройте настройки сайта в браузере и включите камеру с микрофоном",
    "3. Нажмите «Разрешить камеру» ещё раз",
  ].join("\n");
}

export function describeMediaError(err: unknown): string {
  const name = errorName(err);
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Камера и микрофон работают только на https.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Камера или микрофон не найдены.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "Камера занята другим приложением. Закройте его и нажмите ещё раз.";
  }
  if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
    return isAppleMobile()
      ? "Этот браузер не даёт камеру. Откройте сайт в Safari."
      : isAndroid()
        ? "Этот браузер не даёт камеру. Откройте сайт в Chrome."
        : "Этот браузер не даёт камеру. Откройте сайт в обычном браузере.";
  }
  if (isInAppBrowser() || isStandaloneDisplay() || isPermissionDenied(err)) {
    return describeMediaPermissionHelp();
  }
  return describeMediaPermissionHelp();
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
