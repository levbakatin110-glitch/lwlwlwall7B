export const runtime = "nodejs";

/** Открой в браузере: если видишь emailGate:true — на сервере новая Мая */
export async function GET() {
  return Response.json({
    ok: true,
    app: "maya",
    build: "2026-08-09-email-geo-v5",
    emailGate: true,
    features: ["email-register", "summary", "pricing", "geo-ip"],
  });
}
