import { NextRequest } from "next/server";
import { distanceKm, LOCATION_MISMATCH_KM } from "@/lib/geo";

export const runtime = "nodejs";

type IpGeo = {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  proxy?: boolean;
  hosting?: boolean;
};

async function lookupIp(ip: string): Promise<IpGeo | null> {
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

function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "";
}

/**
 * Сравнивает GPS браузера с гео по IP.
 * Большое расхождение / proxy / hosting → подозрение на VPN.
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  const ip = clientIp(req);
  const ipGeo = await lookupIp(ip);

  let vpnSuspect = false;
  let reason: string | null = null;
  let distance: number | null = null;

  if (ipGeo?.proxy || ipGeo?.hosting) {
    vpnSuspect = true;
    reason = "proxy_or_hosting";
  }

  if (
    ipGeo &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  ) {
    distance = distanceKm(
      { latitude: lat, longitude: lon },
      { latitude: ipGeo.latitude, longitude: ipGeo.longitude },
    );
    if (distance > LOCATION_MISMATCH_KM) {
      vpnSuspect = true;
      reason = reason || "ip_gps_mismatch";
    }
  }

  // Доп. сигнал: если GPS далеко от города профиля
  const cityLat = Number(req.nextUrl.searchParams.get("cityLat"));
  const cityLon = Number(req.nextUrl.searchParams.get("cityLon"));
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Number.isFinite(cityLat) &&
    Number.isFinite(cityLon)
  ) {
    const dCity = distanceKm(
      { latitude: lat, longitude: lon },
      { latitude: cityLat, longitude: cityLon },
    );
    if (dCity > LOCATION_MISMATCH_KM) {
      vpnSuspect = true;
      reason = reason || "city_gps_mismatch";
      distance = distance ?? dCity;
    }
  }

  return Response.json({
    vpnSuspect,
    reason,
    distanceKm: distance != null ? Math.round(distance) : null,
    ipCity: ipGeo?.city ?? null,
    ipCountry: ipGeo?.country ?? null,
  });
}
