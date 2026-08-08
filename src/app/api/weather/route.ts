import { NextRequest } from "next/server";
import { resolveWeather } from "@/lib/weather";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city")?.trim() || "";
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  const coords =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? { latitude: lat, longitude: lon }
      : null;

  const resolved = await resolveWeather({ city, coords });
  if (!resolved.weather) {
    return Response.json(
      {
        error: resolved.needCity
          ? "Укажите город в профиле"
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
        "Cache-Control": coords
          ? "no-store"
          : "public, max-age=120",
      },
    },
  );
}
