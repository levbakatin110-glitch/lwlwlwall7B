import {
  planPaymentsBypass,
  planPaymentsConfigured,
  planPaymentsLive,
} from "@/lib/plan-products";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    bypass: planPaymentsBypass(),
    live: planPaymentsLive(),
    configured: planPaymentsConfigured(),
  });
}
