import { NextRequest } from "next/server";
import { distanceKm, LOCATION_MISMATCH_KM } from "@/lib/geo";
import { clientIpFromRequest, lookupIpGeo } from "@/lib/ip-geo";

export const runtime = "nodejs";

/**
 * Сравнивает GPS браузера с гео по IP.
 * Большое расхождение / proxy / hosting → подозрение на VPN.
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  const ip = clientIpFromRequest(req);
  const ipGeo = await lookupIpGeo(ip);

  let vpnSuspect = false;
  let reason: string | null = null;
  let distance: number | null = null;

  if (ipGeo?.proxy || ipGeo?.hosting) {
    vpnSuspect = true;
    reason = "proxy_or_hosting";
  }

  if (ipGeo && Number.isFinite(lat) && Number.isFinite(lon)) {
    distance = distanceKm(
      { latitude: lat, longitude: lon },
      { latitude: ipGeo.latitude, longitude: ipGeo.longitude },
    );
    if (distance > LOCATION_MISMATCH_KM) {
      vpnSuspect = true;
      reason = reason || "ip_gps_mismatch";
    }
  }

  const cityLat = Number(req.nextUrl.searchParams.get("cityLat"));
  const cityLon = Number(req.nextUrl.searchParams.get("cityLon"));
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Number.isFinite(cityLat) &&
    Number.isFinite(cityLon)
  ) {
    const cityDist = distanceKm(
      { latitude: lat, longitude: lon },
      { latitude: cityLat, longitude: cityLon },
    );
    if (cityDist > LOCATION_MISMATCH_KM) {
      vpnSuspect = true;
      reason = reason || "city_gps_mismatch";
    }
  }

  return Response.json({
    vpnSuspect,
    reason,
    distanceKm: distance,
    ipCity: ipGeo?.city ?? null,
    ipCountry: ipGeo?.country ?? null,
  });
}
