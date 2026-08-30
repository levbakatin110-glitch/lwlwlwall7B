/** Надёжное получение камеры: exact → ideal → deviceId по label. */

export type CameraFacing = "user" | "environment";

function isBackLabel(label: string): boolean {
  const l = label.toLowerCase();
  return (
    l.includes("back") ||
    l.includes("rear") ||
    l.includes("environment") ||
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
    l.includes("перед") ||
    l.includes("селф")
  );
}

async function openVideoOnly(
  video: MediaTrackConstraints,
): Promise<MediaStreamTrack> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video,
  });
  const track = stream.getVideoTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("no video track");
  }
  return track;
}

/**
 * Видеотрек с нужной стороны. Не трогает микрофон.
 */
export async function getFacingVideoTrack(
  facing: CameraFacing,
  size: { width?: number; height?: number } = {},
): Promise<MediaStreamTrack> {
  const width = size.width ?? 480;
  const height = size.height ?? 480;
  const base = {
    width: { ideal: width },
    height: { ideal: height },
  };

  try {
    return await openVideoOnly({
      ...base,
      facingMode: { exact: facing },
    });
  } catch {
    /* continue */
  }

  // ideal часто отдаёт фронт с пустым facingMode — не считаем успехом
  let idealFallback: MediaStreamTrack | null = null;
  try {
    const track = await openVideoOnly({
      ...base,
      facingMode: { ideal: facing },
    });
    const mode = track.getSettings().facingMode;
    if (mode === facing) return track;
    idealFallback = track;
  } catch {
    /* continue */
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput");
    if (cams.length === 0) throw new Error("no cameras");

    const wantBack = facing === "environment";
    const byLabel = cams.find((d) =>
      wantBack ? isBackLabel(d.label) : isFrontLabel(d.label),
    );
    // На Android без label: обычно [front, back] или наоборот — берём «другую», не первую
    const currentId = idealFallback?.getSettings().deviceId;
    const other =
      cams.find((d) => d.deviceId && d.deviceId !== currentId) || null;
    const pick =
      byLabel ||
      (wantBack
        ? cams.find((d) => !isFrontLabel(d.label)) || other || cams[cams.length - 1]
        : cams.find((d) => !isBackLabel(d.label)) || cams[0]) ||
      cams[0];

    if (!pick?.deviceId) throw new Error("no deviceId");

    const byId = await openVideoOnly({
      ...base,
      deviceId: { exact: pick.deviceId },
    });
    idealFallback?.stop();
    return byId;
  } catch (err) {
    if (idealFallback) return idealFallback;
    throw err;
  }
}

/** Полный stream: видео с нужной стороны + микрофон. */
export async function getFacingAvStream(
  facing: CameraFacing,
  size: { width?: number; height?: number } = {},
): Promise<MediaStream> {
  const videoTrack = await getFacingVideoTrack(facing, size);
  let audio: MediaStream | null = null;
  try {
    audio = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
  } catch {
    /* video-only fallback */
  }
  const tracks = [
    videoTrack,
    ...(audio ? audio.getAudioTracks() : []),
  ];
  return new MediaStream(tracks);
}
