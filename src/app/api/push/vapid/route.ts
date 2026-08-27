import { vapidPublicKey } from "@/lib/push-store";

export const runtime = "nodejs";

export async function GET() {
  const key = vapidPublicKey();
  return Response.json({
    publicKey: key || null,
    configured: Boolean(key),
  });
}
