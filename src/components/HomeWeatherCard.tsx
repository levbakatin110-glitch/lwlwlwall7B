"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WeatherWidget } from "@/components/WeatherWidget";
import { MayaIcon } from "@/components/icons/MayaIcon";
import { useAppStore } from "@/lib/store";
import type { WeatherSnapshot } from "@/lib/types";

export function HomeWeatherCard({
  coords,
  geoPending,
  compact,
  onRequestLocation,
  onVpnSuspect,
}: {
  coords: { latitude: number; longitude: number } | null;
  geoPending?: boolean;
  /** Узкая полоска над чатом, когда уже идёт переписка */
  compact?: boolean;
  onRequestLocation?: () => void;
  onVpnSuspect?: (suspect: boolean) => void;
}) {
  const city = useAppStore((s) => s.profile.city);
  const setProfile = useAppStore((s) => s.setProfile);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [needCity, setNeedCity] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const cityName = city?.trim() || "";

    if (!cityName && !coords) {
      setWeather(null);
      setNeedCity(!geoPending);
      setLoading(Boolean(geoPending));
      onVpnSuspect?.(false);
      return;
    }

    if (geoPending && !coords) {
      setLoading(true);
      return;
    }

    setNeedCity(false);
    setLoading(true);

    const params = new URLSearchParams();
    if (coords) {
      params.set("lat", String(coords.latitude));
      params.set("lon", String(coords.longitude));
      params.set("_", String(Date.now()));
    } else if (cityName) {
      params.set("city", cityName);
    }

    void fetch(`/api/weather?${params}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as WeatherSnapshot & {
          vpnSuspect?: boolean;
          needCity?: boolean;
          source?: string;
          detectedCity?: string | null;
        };
      })
      .then((data) => {
        if (cancelled) return;
        setLoading(false);
        if (!data) {
          setWeather(null);
          setNeedCity(!cityName && !coords);
          onVpnSuspect?.(false);
          return;
        }
        const { vpnSuspect, needCity: nc, detectedCity, ...snap } = data;
        void nc;
        setWeather({
          city: snap.city,
          temperatureC: snap.temperatureC,
          feelsLikeC: snap.feelsLikeC,
          precipitationMm: snap.precipitationMm,
          windKmh: snap.windKmh,
          description: snap.description,
          fetchedAt: snap.fetchedAt,
          weatherCode: snap.weatherCode,
          tempMaxC: snap.tempMaxC,
          tempMinC: snap.tempMinC,
          isNight: snap.isNight,
        });
        onVpnSuspect?.(Boolean(vpnSuspect));

        if (coords && detectedCity?.trim()) {
          const current = useAppStore.getState().profile;
          if (current.city?.trim() !== detectedCity.trim()) {
            setProfile({ ...current, city: detectedCity.trim() });
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setWeather(null);
          onVpnSuspect?.(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, coords?.latitude, coords?.longitude, geoPending, onVpnSuspect, setProfile]);

  if (loading || (geoPending && !weather && !needCity)) {
    return (
      <div
        className={`rounded-[var(--radius-card)] border border-line bg-card/70 px-3.5 py-2.5 ${
          compact ? "mb-0" : "mb-3"
        }`}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          погода · определяю место…
        </p>
      </div>
    );
  }

  if (needCity) {
    return (
      <div
        className={`rounded-[var(--radius-card)] border border-accent/30 bg-accent-soft/50 px-3.5 py-3 ${
          compact ? "mb-0" : "mb-3"
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          погода
        </p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">
          Нужна геолокация — как в приложениях погоды.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {onRequestLocation && (
            <button
              type="button"
              onClick={onRequestLocation}
              className="rounded-xl bg-accent px-3 py-1.5 text-sm font-semibold text-[var(--on-accent)]"
            >
              Определить по GPS
            </button>
          )}
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
          >
            <MayaIcon name="profile" size={14} />
            Город вручную
          </Link>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2">
        <WeatherWidget weather={weather} compact className="maya-msg-in min-w-0 flex-1" />
        {onRequestLocation && (
          <button
            type="button"
            onClick={onRequestLocation}
            className="shrink-0 rounded-xl border border-line px-2.5 py-2 text-[11px] font-medium text-muted hover:text-accent"
            title="Обновить место"
          >
            GPS
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative mb-3">
      <WeatherWidget weather={weather} compact className="maya-msg-in" />
      {onRequestLocation && (
        <button
          type="button"
          onClick={onRequestLocation}
          className="mt-2 text-xs font-medium text-muted hover:text-accent"
        >
          Обновить место
        </button>
      )}
    </div>
  );
}
