import { NextRequest } from "next/server";
import { clientIpFromRequest, lookupIpGeo } from "@/lib/ip-geo";

export const runtime = "nodejs";

/** Приблизительный город/координаты по IP клиента (когда GPS недоступен). */
export async function GET(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  const geo = ip ? await lookupIpGeo(ip) : null;
  if (!geo) {
    // запас: спросить ip-api без IP — определит IP исходящего запроса сервера (хуже),
    // но на VPS без proxy иногда client IP не виден; клиент тогда пробует публичный API.
    return Response.json(
      { ok: false, error: "ip_unknown", ip: ip || null },
      { status: 404 },
    );
  }
  return Response.json({
    ok: true,
    latitude: geo.latitude,
    longitude: geo.longitude,
    city: geo.city ?? null,
    country: geo.country ?? null,
    source: "ip",
  });
}
