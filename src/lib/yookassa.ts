import { randomUUID } from "crypto";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

const API = "https://api.yookassa.ru/v3/payments";

export type YookassaPayment = {
  id: string;
  status: string;
  paid?: boolean;
  amount?: { value?: string; currency?: string };
  confirmation?: { confirmation_url?: string };
  metadata?: Record<string, string>;
};

export function yookassaReady(): boolean {
  return Boolean(yookassaShopId() && yookassaSecret());
}

export function yookassaShopId(): string {
  return process.env.YOOKASSA_SHOP_ID?.trim() || "";
}

function yookassaSecret(): string {
  return process.env.YOOKASSA_SECRET_KEY?.trim() || "";
}

export function yookassaSite(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "https://hey-maya.ru"
  );
}

function authHeader(): string {
  const raw = `${yookassaShopId()}:${yookassaSecret()}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

export function formatRubAmount(rub: number): string {
  return (Math.round(rub * 100) / 100).toFixed(2);
}

export function amountToKopeks(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const rub = Number(match[1]);
  const frac = Number((match[2] || "").padEnd(2, "0"));
  return rub * 100 + frac;
}

export async function yookassaCreatePayment(opts: {
  amountRub: number;
  description: string;
  returnUrl: string;
  email: string;
  metadata: Record<string, string>;
}): Promise<{ id: string; url: string }> {
  if (!yookassaReady()) {
    throw new Error("ЮKassa не настроена");
  }
  const amount = formatRubAmount(opts.amountRub);
  const res = await fetchWithTimeout(API, {
    method: "POST",
    timeoutMs: 12_000,
    headers: {
      Authorization: authHeader(),
      "Idempotence-Key": randomUUID(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: { value: amount, currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: opts.returnUrl },
      description: opts.description.slice(0, 128),
      metadata: opts.metadata,
      receipt: {
        customer: { email: opts.email },
        items: [
          {
            description: opts.description.slice(0, 128),
            quantity: "1.00",
            amount: { value: amount, currency: "RUB" },
            vat_code: 1,
            payment_mode: "full_payment",
            payment_subject: "service",
          },
        ],
      },
    }),
  });
  const data = (await res.json().catch(() => null)) as
    | (YookassaPayment & { description?: string })
    | null;
  const url = data?.confirmation?.confirmation_url;
  if (!res.ok || !data?.id || !url) {
    throw new Error(data?.description || "Не удалось создать оплату");
  }
  return { id: data.id, url };
}

export async function yookassaGetPayment(
  paymentId: string,
): Promise<YookassaPayment | null> {
  if (!yookassaReady() || !paymentId) return null;
  const res = await fetchWithTimeout(`${API}/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    timeoutMs: 12_000,
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) return null;
  return (await res.json()) as YookassaPayment;
}
