import { readFileSync } from "fs";
import { resolveMediaPath } from "@/lib/community-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
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
    const buf = readFileSync(media.path);
    return new Response(buf, {
      headers: {
        "Content-Type": media.mime,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
