import { readFileSync } from "fs";
import {
  avatarContentType,
  resolveAvatarPath,
} from "@/lib/community-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ key: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  const safe = String(key || "").replace(/[^a-f0-9]/gi, "").slice(0, 32);
  if (!safe) {
    return new Response("Not found", { status: 404 });
  }
  const path = resolveAvatarPath(safe);
  if (!path) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const buf = readFileSync(path);
    return new Response(buf, {
      headers: {
        "Content-Type": avatarContentType(path),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
