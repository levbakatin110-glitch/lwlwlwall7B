/** Геолокация по IP (запасной вариант, когда GPS в браузере недоступен). */

import type { NextRequest } from "next/server";

export type IpGeo = {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  proxy?: boolean;
  hosting?: boolean;
};

export function clientIpFromHeaders(headers: Headers): string {
  const xf = headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "";
}

export function clientIpFromRequest(req: Request | NextRequest): string {
  const fromHeaders = clientIpFromHeaders(req.headers);
  if (fromHeaders) return fromHeaders;
  const maybeIp = (req as NextRequest & { ip?: string | null }).ip;
  if (typeof maybeIp === "string" && maybeIp && maybeIp !== "::1") return maybeIp;
  return "";
}

export async function lookupIpGeo(ip: string): Promise<IpGeo | null> {
  if (
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.")
  ) {
    return null;
  }

  const clean = ip.startsWith("::ffff:") ? ip.slice(7) : ip;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(clean)}?fields=status,lat,lon,city,country,proxy,hosting`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      lat?: number;
      lon?: number;
      city?: string;
      country?: string;
      proxy?: boolean;
      hosting?: boolean;
    };
    if (data.status !== "success" || data.lat == null || data.lon == null) {
      return null;
    }
    return {
      latitude: data.lat,
      longitude: data.lon,
      city: data.city,
      country: data.country,
      proxy: Boolean(data.proxy),
      hosting: Boolean(data.hosting),
    };
  } catch {
    return null;
  }
}
