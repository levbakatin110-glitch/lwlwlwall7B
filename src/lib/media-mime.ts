import type { CommunityMediaKind } from "@/lib/community-store";

/** Определяем реальный формат по заголовку файла — iOS часто шлёт application/octet-stream. */
export function sniffMediaMime(
  buf: Buffer,
  kind?: CommunityMediaKind,
): string | null {
  if (buf.length < 12) return null;

  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return kind === "voice" ? "audio/webm" : "video/webm";
  }

  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    return kind === "voice" ? "audio/mp4" : "video/mp4";
  }

  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
    return "audio/ogg";
  }

  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }

  return null;
}

export function resolveUploadMime(
  buf: Buffer,
  declared: string,
  kind: CommunityMediaKind,
): string {
  const clean = declared?.split(";")[0]?.trim() || "";
  if (
    clean &&
    clean !== "application/octet-stream" &&
    (clean.startsWith("video/") ||
      clean.startsWith("audio/") ||
      clean.startsWith("image/"))
  ) {
    return clean;
  }

  const sniffed = sniffMediaMime(buf, kind);
  if (sniffed) return sniffed;

  if (kind === "image") return "image/jpeg";
  if (kind === "voice") return "audio/webm";
  if (kind === "circle" || kind === "video") return "video/webm";
  return "application/octet-stream";
}

export function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isWebmUnsupported(): boolean {
  if (typeof document === "undefined") return false;
  const v = document.createElement("video");
  return !v.canPlayType('video/webm; codecs="vp8, opus"');
}
