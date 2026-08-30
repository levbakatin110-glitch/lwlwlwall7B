"use client";

import { useEffect, useState } from "react";
import { MayaIcon } from "@/components/icons/MayaIcon";

const DISMISS_KEY = "maya-vpn-hint-dismissed";

export function VpnHintBanner({
  coords,
  city,
  forceShow = false,
}: {
  coords: { latitude: number; longitude: number } | null;
  city?: string;
  /** Показать после ответа чата, если сервер заподозрил VPN */
  forceShow?: boolean;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (forceShow) {
      try {
        if (localStorage.getItem(DISMISS_KEY) === "1") return;
      } catch {
        /* ignore */
      }
      setShow(true);
      return;
    }

    if (!coords) return;
    let cancelled = false;

    const params = new URLSearchParams({
      lat: String(coords.latitude),
      lon: String(coords.longitude),
    });

    void (async () => {
      try {
        if (localStorage.getItem(DISMISS_KEY) === "1") return;
      } catch {
        /* ignore */
      }

      // Геокод города на клиенте через /api/weather?city= — или vpn-check с city coords
      if (city?.trim()) {
        try {
          const geoRes = await fetch(
            `/api/geocode?city=${encodeURIComponent(city.trim())}`,
          );
          if (geoRes.ok) {
            const g = (await geoRes.json()) as {
              latitude?: number;
              longitude?: number;
            };
            if (g.latitude != null && g.longitude != null) {
              params.set("cityLat", String(g.latitude));
              params.set("cityLon", String(g.longitude));
            }
          }
        } catch {
          /* ignore */
        }
      }

      try {
        const res = await fetch(`/api/vpn-check?${params}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { vpnSuspect?: boolean };
        if (!cancelled && data.vpnSuspect) setShow(true);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coords?.latitude, coords?.longitude, city, forceShow]);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="maya-msg-in mb-4 rounded-2xl border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-sm text-foreground">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
          <MayaIcon name="pulse" size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-200">VPN не мешает Мае</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Чат и дневники работают как обычно. Погоду берём из города в профиле,
            а не с IP VPN. Если город не тот — поправьте в разделе «Малыш».
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="mt-2 text-xs font-medium text-amber-200/90 underline-offset-2 hover:underline"
          >
            Понятно
          </button>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1.5 text-muted hover:bg-card hover:text-foreground"
          aria-label="Закрыть"
        >
          <MayaIcon name="close" size={16} />
        </button>
      </div>
    </div>
  );
}
