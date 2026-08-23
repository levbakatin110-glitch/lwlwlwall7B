import type { WeatherSnapshot } from "./types";
import { distanceKm, LOCATION_MISMATCH_KM } from "./geo";
import { fetchWithTimeout } from "./fetch-timeout";

const WEATHER_CODE_RU: Record<number, string> = {
  0: "ясно",
  1: "преимущественно ясно",
  2: "переменная облачность",
  3: "пасмурно",
  45: "туман",
  48: "изморозь",
  51: "лёгкая морось",
  53: "морось",
  55: "сильная морось",
  61: "небольшой дождь",
  63: "дождь",
  65: "сильный дождь",
  71: "небольшой снег",
  73: "снег",
  75: "сильный снег",
  80: "ливень",
  81: "ливень",
  82: "сильный ливень",
  95: "гроза",
};

export function weatherDescription(code: number): string {
  return WEATHER_CODE_RU[code] ?? `код погоды ${code}`;
}

/** Короткая подпись для виджета: «Ясно» */
export function weatherShortLabel(code: number): string {
  if (code === 0 || code === 1) return "Ясно";
  if (code === 2) return "Облачно";
  if (code === 3) return "Пасмурно";
  if (code === 45 || code === 48) return "Туман";
  if (code >= 51 && code <= 67) return "Дождь";
  if (code >= 71 && code <= 77) return "Снег";
  if (code >= 80 && code <= 82) return "Ливень";
  if (code >= 95) return "Гроза";
  return weatherDescription(code);
}

export function encodeWeatherHeader(weather: WeatherSnapshot): string {
  const json = JSON.stringify(weather);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeWeatherHeader(raw: string | null): WeatherSnapshot | null {
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json) as WeatherSnapshot;
    if (
      typeof data.city !== "string" ||
      typeof data.temperatureC !== "number" ||
      typeof data.description !== "string"
    ) {
      return null;
    }
    return {
      ...data,
      weatherCode: data.weatherCode ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetchWeatherAt(
  latitude: number,
  longitude: number,
  placeLabel: string,
): Promise<WeatherSnapshot | null> {
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", String(latitude));
  weatherUrl.searchParams.set("longitude", String(longitude));
  weatherUrl.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
  );
  weatherUrl.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  weatherUrl.searchParams.set("forecast_days", "1");
  weatherUrl.searchParams.set("wind_speed_unit", "kmh");
  weatherUrl.searchParams.set("timezone", "auto");

  const wRes = await fetchWithTimeout(weatherUrl.toString(), {
    cache: "no-store",
    timeoutMs: 2500,
  });
  if (!wRes.ok) return null;
  const data = (await wRes.json()) as {
    current?: {
      temperature_2m: number;
      apparent_temperature: number;
      precipitation: number;
      weather_code: number;
      wind_speed_10m: number;
      is_day?: number;
    };
    daily?: {
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
    };
  };
  const c = data.current;
  if (!c) return null;

  const max = data.daily?.temperature_2m_max?.[0];
  const min = data.daily?.temperature_2m_min?.[0];

  return {
    city: placeLabel,
    temperatureC: Math.round(c.temperature_2m),
    feelsLikeC: Math.round(c.apparent_temperature * 10) / 10,
    precipitationMm: c.precipitation,
    windKmh: c.wind_speed_10m,
    description: weatherDescription(c.weather_code),
    weatherCode: c.weather_code,
    tempMaxC: typeof max === "number" ? Math.round(max) : undefined,
    tempMinC: typeof min === "number" ? Math.round(min) : undefined,
    isNight: c.is_day === 0,
    fetchedAt: new Date().toISOString(),
  };
}

export async function geocodeCity(
  city: string,
): Promise<{ name: string; latitude: number; longitude: number } | null> {
  const q = city.trim();
  if (!q) return null;

  const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geoUrl.searchParams.set("name", q);
  geoUrl.searchParams.set("count", "5");
  geoUrl.searchParams.set("language", "ru");
  geoUrl.searchParams.set("format", "json");
  // Для мам в РФ чаще нужен российский город
  geoUrl.searchParams.set("countryCode", "RU");

  const geoRes = await fetchWithTimeout(geoUrl.toString(), {
    next: { revalidate: 3600 },
    timeoutMs: 2500,
  });
  if (!geoRes.ok) return null;
  const geo = (await geoRes.json()) as {
    results?: {
      name: string;
      latitude: number;
      longitude: number;
      country?: string;
      admin1?: string;
    }[];
  };

  let place = geo.results?.[0];

  // Если с countryCode=RU пусто — пробуем без фильтра
  if (!place) {
    const fallback = new URL("https://geocoding-api.open-meteo.com/v1/search");
    fallback.searchParams.set("name", q);
    fallback.searchParams.set("count", "3");
    fallback.searchParams.set("language", "ru");
    fallback.searchParams.set("format", "json");
    const fbRes = await fetchWithTimeout(fallback.toString(), {
      next: { revalidate: 3600 },
      timeoutMs: 2500,
    });
    if (fbRes.ok) {
      const fb = (await fbRes.json()) as {
        results?: { name: string; latitude: number; longitude: number }[];
      };
      place = fb.results?.[0];
    }
  }

  if (!place) return null;
  return {
    name: place.admin1 ? `${place.name}` : place.name,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

export async function fetchWeatherForCoords(
  latitude: number,
  longitude: number,
  placeLabel = "рядом с вами",
): Promise<WeatherSnapshot | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return fetchWeatherAt(latitude, longitude, placeLabel);
}

/** Название города по координатам (Nominatim / OSM) */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<{ name: string; latitude: number; longitude: number } | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ru");
  url.searchParams.set("zoom", "10");

  const res = await fetchWithTimeout(url.toString(), {
    headers: {
      "User-Agent": "MayaMomAssistant/1.0 (local; weather city detect)",
      Accept: "application/json",
    },
    next: { revalidate: 3600 },
    timeoutMs: 2500,
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    address?: {
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      county?: string;
      state?: string;
    };
    name?: string;
  };

  const a = data.address;
  const name =
    a?.city ||
    a?.town ||
    a?.village ||
    a?.municipality ||
    a?.county ||
    data.name ||
    null;
  if (!name) return null;

  return { name, latitude, longitude };
}

export async function fetchWeatherForCity(city: string): Promise<WeatherSnapshot | null> {
  const place = await geocodeCity(city);
  if (!place) return null;
  return fetchWeatherAt(place.latitude, place.longitude, place.name);
}

export type WeatherResolveResult = {
  weather: WeatherSnapshot | null;
  vpnSuspect: boolean;
  source: "city" | "coords" | "none";
  needCity: boolean;
  /** Город, определённый по GPS — можно сохранить в профиль */
  detectedCity?: string | null;
};

/**
 * Как в приложениях погоды: сначала точные координаты телефона/GPS,
 * иначе — город из профиля.
 */
export async function resolveWeather(opts: {
  city?: string | null;
  coords?: { latitude: number; longitude: number } | null;
}): Promise<WeatherResolveResult> {
  const city = opts.city?.trim() || "";
  const coords = opts.coords;
  const hasCoords =
    Boolean(coords) &&
    Number.isFinite(coords!.latitude) &&
    Number.isFinite(coords!.longitude);

  // 1) GPS телефона — как Яндекс.Погода / Gismeteo
  if (hasCoords) {
    const place = await reverseGeocode(
      coords!.latitude,
      coords!.longitude,
    ).catch(() => null);
    const label = place?.name || "рядом с вами";

    let vpnSuspect = false;
    if (city) {
      const cityPlace = await geocodeCity(city).catch(() => null);
      if (cityPlace) {
        const dist = distanceKm(
          { latitude: cityPlace.latitude, longitude: cityPlace.longitude },
          { latitude: coords!.latitude, longitude: coords!.longitude },
        );
        if (dist > LOCATION_MISMATCH_KM) vpnSuspect = true;
      }
    }

    const weather = await fetchWeatherAt(
      coords!.latitude,
      coords!.longitude,
      label,
    ).catch(() => null);

    return {
      weather,
      vpnSuspect,
      source: weather ? "coords" : "none",
      needCity: false,
      detectedCity: place?.name ?? null,
    };
  }

  // 2) Запасной вариант — город из профиля
  if (city) {
    const place = await geocodeCity(city).catch(() => null);
    if (!place) {
      return {
        weather: null,
        vpnSuspect: false,
        source: "none",
        needCity: true,
      };
    }

    const weather = await fetchWeatherAt(
      place.latitude,
      place.longitude,
      place.name,
    ).catch(() => null);

    return {
      weather,
      vpnSuspect: false,
      source: weather ? "city" : "none",
      needCity: false,
    };
  }

  return {
    weather: null,
    vpnSuspect: false,
    source: "none",
    needCity: true,
  };
}
