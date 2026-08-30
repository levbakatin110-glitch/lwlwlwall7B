import { NextRequest } from "next/server";
import { clientIpFromRequest, lookupIpGeo } from "@/lib/ip-geo";
import { resolveWeather } from "@/lib/weather";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city")?.trim() || "";
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  let coords =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? { latitude: lat, longitude: lon }
      : null;

  // IP — только если нет ни GPS, ни города. Иначе VPN подставляет чужую страну.
  if (!coords && !city) {
    const ipGeo = await lookupIpGeo(clientIpFromRequest(req));
    if (ipGeo) {
      coords = { latitude: ipGeo.latitude, longitude: ipGeo.longitude };
    }
  }

  const resolved = await resolveWeather({ city, coords });
  if (!resolved.weather) {
    return Response.json(
      {
        error: resolved.needCity
          ? "Укажите город в профиле или разрешите геолокацию"
          : "Погода недоступна",
        needCity: resolved.needCity,
        vpnSuspect: resolved.vpnSuspect,
      },
      { status: 404 },
    );
  }

  return Response.json(
    {
      ...resolved.weather,
      vpnSuspect: resolved.vpnSuspect,
      source: resolved.source,
      needCity: resolved.needCity,
      detectedCity: resolved.detectedCity ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
