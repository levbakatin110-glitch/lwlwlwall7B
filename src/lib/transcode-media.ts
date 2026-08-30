import { execFile } from "child_process";
import { existsSync } from "fs";
import { readFile, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { randomBytes } from "crypto";
import type { CommunityMediaKind } from "@/lib/community-store";
import { sniffMediaMime } from "@/lib/media-mime";

const execFileAsync = promisify(execFile);

let ffmpegOk: boolean | null = null;

async function hasFfmpeg(): Promise<boolean> {
  if (ffmpegOk !== null) return ffmpegOk;
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    ffmpegOk = true;
  } catch {
    ffmpegOk = false;
  }
  return ffmpegOk;
}

async function withTempFiles<T>(
  inputExt: string,
  outputExt: string,
  run: (input: string, output: string) => Promise<T>,
): Promise<T | null> {
  const id = randomBytes(6).toString("hex");
  const input = join(tmpdir(), `maya-in-${id}.${inputExt}`);
  const output = join(tmpdir(), `maya-out-${id}.${outputExt}`);
  try {
    return await run(input, output);
  } finally {
    await unlink(input).catch(() => undefined);
    await unlink(output).catch(() => undefined);
  }
}

/** WebM → MP4 (H.264+AAC) для Safari / iPhone */
export async function transcodeVideoToMp4(buffer: Buffer): Promise<Buffer | null> {
  if (!(await hasFfmpeg())) return null;
  return withTempFiles("webm", "mp4", async (input, output) => {
    await writeFile(input, buffer);
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        input,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "28",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
        output,
      ],
      { timeout: 120_000 },
    );
    return readFile(output);
  });
}

/** WebM/OGG → M4A (AAC) для Safari */
export async function transcodeAudioToM4a(buffer: Buffer): Promise<Buffer | null> {
  if (!(await hasFfmpeg())) return null;
  return withTempFiles("webm", "m4a", async (input, output) => {
    await writeFile(input, buffer);
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        input,
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        "-movflags",
        "+faststart",
        output,
      ],
      { timeout: 90_000 },
    );
    return readFile(output);
  });
}

export function convertedMediaPath(
  originalPath: string,
  kind: CommunityMediaKind,
): string {
  const base = originalPath.replace(/\.[^.]+$/, "");
  if (kind === "voice") return `${base}.m4a`;
  if (kind === "circle" || kind === "video") return `${base}.mp4`;
  return originalPath;
}

export function needsSafariTranscode(
  mime: string,
  kind?: CommunityMediaKind,
): boolean {
  if (kind !== "circle" && kind !== "voice" && kind !== "video") return false;
  const m = mime.toLowerCase();
  if (kind === "voice") {
    return m.includes("webm") || m.includes("ogg");
  }
  return m.includes("webm");
}

export async function ensureSafariFriendlyBuffer(
  buffer: Buffer,
  kind: CommunityMediaKind,
  mime: string,
): Promise<{ buffer: Buffer; mime: string }> {
  const sniffed = sniffMediaMime(buffer, kind) || mime;
  const effective = sniffed.split(";")[0];

  if (kind === "circle" || kind === "video") {
    if (effective.includes("mp4") || effective.includes("quicktime")) {
      return { buffer, mime: "video/mp4" };
    }
    if (!needsSafariTranscode(effective, kind)) {
      return { buffer, mime: effective };
    }
    const mp4 = await transcodeVideoToMp4(buffer);
    if (mp4) return { buffer: mp4, mime: "video/mp4" };
    return { buffer, mime: effective };
  }

  if (kind === "voice") {
    if (
      effective.includes("mp4") ||
      effective.includes("m4a") ||
      effective.includes("mpeg")
    ) {
      return { buffer, mime: "audio/mp4" };
    }
    if (!needsSafariTranscode(effective, kind)) {
      return { buffer, mime: effective };
    }
    const m4a = await transcodeAudioToM4a(buffer);
    if (m4a) return { buffer: m4a, mime: "audio/mp4" };
    return { buffer, mime: effective };
  }

  return { buffer, mime: effective };
}

/** При отдаче: если есть кэш .mp4/.m4a — берём его, иначе конвертируем */
export async function resolvePlaybackBuffer(
  path: string,
  kind?: CommunityMediaKind,
): Promise<{ buffer: Buffer; mime: string }> {
  const buf = await readFile(path);
  let mime = sniffMediaMime(buf, kind) || "application/octet-stream";

  if (!kind || !needsSafariTranscode(mime, kind)) {
    return { buffer: buf, mime };
  }

  const cached = convertedMediaPath(path, kind);
  if (existsSync(cached)) {
    const cachedBuf = await readFile(cached);
    return {
      buffer: cachedBuf,
      mime: kind === "voice" ? "audio/mp4" : "video/mp4",
    };
  }

  const converted = await ensureSafariFriendlyBuffer(buf, kind, mime);
  if (converted.mime.includes("mp4") && !converted.buffer.equals(buf)) {
    await writeFile(cached, converted.buffer);
    return { buffer: converted.buffer, mime: converted.mime };
  }

  return { buffer: buf, mime };
}
