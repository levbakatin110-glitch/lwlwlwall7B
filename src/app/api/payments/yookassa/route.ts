import { fulfillYookassaPayment } from "@/lib/yookassa-payments";
import { pushServerOpsError } from "@/lib/ops-log";

export const runtime = "nodejs";

/** Уведомление ЮKassa. Доступ выдаём только после повторного запроса платежа в API. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      event?: string;
      object?: { id?: string };
    };
    const paymentId = body.object?.id?.trim() || "";
    if (!paymentId || body.event !== "payment.succeeded") {
      return new Response("ok", { status: 200 });
    }
    await fulfillYookassaPayment(paymentId);
    return new Response("ok", { status: 200 });
  } catch (err) {
    pushServerOpsError({
      source: "other",
      message: err instanceof Error ? err.message : "YooKassa webhook error",
      status: 500,
    });
    return new Response("error", { status: 500 });
  }
}
