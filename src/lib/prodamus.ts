import { createHmac, timingSafeEqual } from "crypto";

/** Рекурсивная сортировка ключей — как в Hmac.php Prodamus */
export function prodamusSort(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => prodamusSort(item));
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = prodamusSort(obj[key]);
    }
    return sorted;
  }
  return data;
}

export function prodamusSign(data: unknown, secret: string): string {
  const payload = JSON.stringify(prodamusSort(data));
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function prodamusVerify(
  data: unknown,
  secret: string,
  sign: string | null | undefined,
): boolean {
  if (!sign || !secret) return false;
  const expected = prodamusSign(data, secret);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(String(sign).toLowerCase(), "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function prodamusConfig() {
  const secret = process.env.PRODAMUS_SECRET_KEY?.trim() || "";
  const payform =
    process.env.PRODAMUS_PAYFORM_URL?.trim().replace(/\/$/, "") || "";
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "http://194.67.101.192:3000";
  return { secret, payform, site };
}
