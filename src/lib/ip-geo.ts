/** Геолокация по IP (запасной вариант, когда GPS в браузере недоступен). */

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

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,lat,lon,city,country,proxy,hosting`,
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
