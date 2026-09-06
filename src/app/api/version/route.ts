import { readFileSync } from "fs";
import { join } from "path";
import { resendFromAddress } from "@/lib/resend";

export const runtime = "nodejs";

function readBuildId(): string | null {
  try {
    return readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return null;
  }
}

/** Smoke: /api/version — жив ли сервер и какой билд */
export async function GET() {
  return Response.json({
    ok: true,
    app: "maya",
    buildId: readBuildId(),
    mailFrom: resendFromAddress(),
    betterstack: Boolean(process.env.NEXT_PUBLIC_BETTERSTACK_DSN?.trim()),
    features: ["email-register", "feedback", "betterstack", "chat", "push"],
  });
}
