/** Камера: один getUserMedia на открытие/переключение, без спама «доступ разрешён». */

export type CameraFacing = "user" | "environment";

type CameraIds = { front?: string; back?: string };

let cachedIds: CameraIds | null = null;

function isBackLabel(label: string): boolean {
  const l = label.toLowerCase();
  return (
    l.includes("back") ||
    l.includes("rear") ||
    l.includes("environment") ||
    l.includes("facing back") ||
    l.includes("задн") ||
    l.includes("тыл")
  );
}

function isFrontLabel(label: string): boolean {
  const l = label.toLowerCase();
  return (
    l.includes("front") ||
    l.includes("user") ||
    l.includes("face") ||
    l.includes("facing front") ||
    l.includes("перед") ||
    l.includes("селф")
  );
}

function videoSize(size: { width?: number; height?: number }) {
  return {
    width: { ideal: size.width ?? 480 },
    height: { ideal: size.height ?? 480 },
  };
}

/** После первого разрешения лейблы устройств доступны — кэшируем front/back. */
export async function rememberCameraIds(
  currentDeviceId?: string,
): Promise<CameraIds> {
  if (cachedIds?.front || cachedIds?.back) return cachedIds;

  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
  const front =
    cams.find((d) => isFrontLabel(d.label))?.deviceId ||
    cams[0]?.deviceId;
  const back =
    cams.find((d) => isBackLabel(d.label))?.deviceId ||
    cams.find((d) => d.deviceId !== front)?.deviceId ||
    cams[cams.length - 1]?.deviceId;

  cachedIds = {
    front: front || currentDeviceId,
    back: back && back !== front ? back : cams[1]?.deviceId,
  };
  return cachedIds;
}

function idForFacing(facing: CameraFacing, ids: CameraIds): string | undefined {
  return facing === "environment" ? ids.back : ids.front;
}

/**
 * Один вызов: видео + микрофон.
 * Без цепочки exact→ideal→deviceId (она спамит тостами Android).
 */
export async function getFacingAvStream(
  facing: CameraFacing,
  size: { width?: number; height?: number } = {},
): Promise<MediaStream> {
  const ids = cachedIds;
  const deviceId = ids ? idForFacing(facing, ids) : undefined;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: deviceId
      ? { deviceId: { exact: deviceId }, ...videoSize(size) }
      : { facingMode: { ideal: facing }, ...videoSize(size) },
  });

  const vid = stream.getVideoTracks()[0];
  await rememberCameraIds(vid?.getSettings().deviceId);
  return stream;
}

/**
 * Сменить только видео на том же MediaStream (микрофон не трогаем).
 * Старый видеотрек гасим ДО нового getUserMedia — иначе Android шлёт тосты
 * и часто блокирует вторую камеру.
 * Ровно один getUserMedia на переключение.
 */
export async function switchStreamFacing(
  stream: MediaStream,
  facing: CameraFacing,
  size: { width?: number; height?: number } = {},
): Promise<void> {
  const current = stream.getVideoTracks()[0];
  const currentId = current?.getSettings().deviceId;
  const ids = await rememberCameraIds(currentId);
  let targetId = idForFacing(facing, ids);

  // Нет label — берём «другую» камеру
  if (!targetId || targetId === currentId) {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
    targetId = cams.find((d) => d.deviceId !== currentId)?.deviceId;
  }
  if (!targetId) throw new Error("no other camera");

  if (current) {
    stream.removeTrack(current);
    current.stop();
  }

  const fresh = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      deviceId: { exact: targetId },
      ...videoSize(size),
    },
  });
  const next = fresh.getVideoTracks()[0];
  if (!next) {
    fresh.getTracks().forEach((t) => t.stop());
    throw new Error("no video track");
  }
  stream.addTrack(next);

  // Обновим кэш, если узнали сторону
  if (facing === "environment") {
    cachedIds = { ...ids, back: targetId };
  } else {
    cachedIds = { ...ids, front: targetId };
  }
}
