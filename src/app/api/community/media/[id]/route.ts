import { resolveMediaPath } from "@/lib/community-store";
import { resolvePlaybackBuffer } from "@/lib/transcode-media";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function byteRange(
  size: number,
  rangeHeader: string | null,
): { start: number; end: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null;
  const [startStr, endStr] = rangeHeader.slice(6).split("-");
  const start = Number(startStr);
  if (!Number.isFinite(start) || start < 0) return null;
  const end =
    endStr && endStr.length > 0
      ? Math.min(Number(endStr), size - 1)
      : size - 1;
  if (!Number.isFinite(end) || end < start) return null;
  return { start, end };
}

/** Node Buffer ≠ DOM BodyInit в типах Next/TS — отдаём Uint8Array. */
function asBody(buf: Uint8Array): Uint8Array {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const safe = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!safe) {
    return new Response("Not found", { status: 404 });
  }
  const media = resolveMediaPath(safe);
  if (!media) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const { buffer, mime } = await resolvePlaybackBuffer(media.path, media.kind);
    const size = buffer.length;
    const range = byteRange(size, req.headers.get("range"));

    const baseHeaders: Record<string, string> = {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
    };

    if (range) {
      const chunk = buffer.subarray(range.start, range.end + 1);
      return new Response(asBody(chunk), {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        },
      });
    }

    return new Response(asBody(buffer), {
      headers: {
        ...baseHeaders,
        "Content-Length": String(size),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
