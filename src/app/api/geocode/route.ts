import { NextRequest } from "next/server";
import { geocodeCity } from "@/lib/weather";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city")?.trim() || "";
  if (!city) {
    return Response.json({ error: "Нет города" }, { status: 400 });
  }
  const place = await geocodeCity(city).catch(() => null);
  if (!place) {
    return Response.json({ error: "Город не найден" }, { status: 404 });
  }
  return Response.json(place, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
