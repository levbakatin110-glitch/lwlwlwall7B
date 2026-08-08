"use client";

import { weatherShortLabel } from "@/lib/weather";
import type { WeatherSnapshot } from "@/lib/types";

function WeatherIcon({
  code,
  isNight,
  className = "",
}: {
  code: number;
  isNight?: boolean;
  className?: string;
}) {
  if (code >= 71 && code <= 77) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path
          d="M12 3v2.5M12 18.5V21M4.2 4.2l1.8 1.8M18 18l1.8 1.8M3 12h2.5M18.5 12H21M4.2 19.8 6 18M18 6l1.8-1.8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="3.2" fill="currentColor" opacity="0.35" />
        <path
          d="M8 16.5h8M9.5 18.5h5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path
          d="M7.5 14.5a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 19 10.5a3.5 3.5 0 0 1-.2 7H7.5Z"
          fill="currentColor"
          opacity="0.9"
        />
        <path
          d="M9 17.5v2.5M12 17v3M15 17.5v2.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (code === 2 || code === 3 || code === 45 || code === 48) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path
          d="M7.5 15.5a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 19 11.5a3.5 3.5 0 0 1-.2 7H7.5Z"
          fill="currentColor"
          opacity="0.92"
        />
      </svg>
    );
  }
  if (isNight) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path
          d="M15.2 3.6A8.5 8.5 0 1 0 20.4 14 7 7 0 0 1 15.2 3.6Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M5.1 18.9l1.6-1.6M17.3 6.7l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WeatherWidget({
  weather,
  compact = false,
  className = "",
}: {
  weather: WeatherSnapshot;
  compact?: boolean;
  className?: string;
}) {
  const night = Boolean(weather.isNight);
  const code = weather.weatherCode ?? 0;
  const label = weatherShortLabel(code);
  const city = weather.city.replace(/,.*$/, "").trim() || weather.city;
  const temp = Math.round(weather.temperatureC);
  const max =
    weather.tempMaxC != null ? Math.round(weather.tempMaxC) : null;
  const min =
    weather.tempMinC != null ? Math.round(weather.tempMinC) : null;

  const gradient = night
    ? "linear-gradient(160deg, #0b1c3a 0%, #152447 45%, #1a1030 100%)"
    : code >= 51
      ? "linear-gradient(160deg, #3d4f66 0%, #5a6b7d 50%, #6d7f90 100%)"
      : "linear-gradient(160deg, #1a6bb5 0%, #3b8fd4 48%, #6eb6ef 100%)";

  return (
    <div
      className={`relative overflow-hidden text-white shadow-lg ring-1 ring-white/10 ${
        compact
          ? "rounded-[1.35rem] px-3.5 py-3"
          : "rounded-[1.75rem] px-4 py-3.5 sm:px-5 sm:py-4"
      } ${className}`}
      style={{ background: gradient }}
      aria-label={`Погода: ${city}, ${temp}°`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.35), transparent 55%)",
        }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`flex items-center gap-1 font-medium text-white/90 ${
              compact ? "text-[11px]" : "text-xs sm:text-sm"
            }`}
          >
            <span className="truncate">{city}</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="shrink-0 opacity-80"
              aria-hidden
            >
              <path d="M12 2.5 4.5 20.5l7.5-3.2 7.5 3.2L12 2.5Z" />
            </svg>
          </p>
          <p
            className={`mt-0.5 font-semibold leading-none tracking-tight ${
              compact ? "text-[2.35rem]" : "text-[3.25rem] sm:text-[3.6rem]"
            }`}
          >
            {temp}°
          </p>
        </div>
        <WeatherIcon
          code={code}
          isNight={night}
          className={`shrink-0 text-white/95 ${
            compact ? "h-10 w-10" : "h-12 w-12 sm:h-14 sm:w-14"
          }`}
        />
      </div>
      <div
        className={`relative mt-2 flex flex-wrap items-end justify-between gap-2 ${
          compact ? "text-[11px]" : "text-xs sm:text-sm"
        }`}
      >
        <p className="font-medium text-white/95">{label}</p>
        {(max != null || min != null) && (
          <p className="text-white/80">
            {max != null && <>Макс.:{max}°</>}
            {max != null && min != null && ", "}
            {min != null && <>мин.:{min}°</>}
          </p>
        )}
      </div>
    </div>
  );
}
