"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const HINT_KEY = "maya-vaccines-tap-hint-v1";
const TARGET = "[data-maya-vaccine-hint]";

type Box = { left: number; top: number; width: number; height: number };

function readTarget(): Box | null {
  const el = document.querySelector(TARGET);
  if (!(el instanceof HTMLElement)) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export function VaccineTapHint({ onPeek }: { onPeek: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [box, setBox] = useState<Box | null>(null);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(HINT_KEY) === "1") return;
    } catch {
      return;
    }
    let inner = 0;
    let tries = 0;
    const start = window.setTimeout(() => {
      const el = document.querySelector(TARGET);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "smooth",
        });
      }
      const tick = () => {
        const next = readTarget();
        if (next) {
          setBox(next);
          setShow(true);
          return;
        }
        if (tries++ < 10) inner = window.setTimeout(tick, 120);
      };
      inner = window.setTimeout(tick, 280);
    }, 450);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(inner);
    };
  }, []);

  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const sync = () => setBox(readTarget());
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, dismiss]);

  if (!mounted || !show || !box) return null;

  const pad = 7;
  const spot = {
    left: box.left - pad,
    top: box.top - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };

  const cardW = Math.min(236, window.innerWidth - 24);
  let cardLeft = box.left + box.width + 10;
  if (cardLeft + cardW > window.innerWidth - 12) {
    cardLeft = Math.max(12, window.innerWidth - cardW - 12);
  }
  let cardTop = box.top + box.height + 52;
  const cardH = 118;
  if (cardTop + cardH > window.innerHeight - 16) {
    cardTop = Math.max(12, box.top - cardH - 36);
  }

  const from = {
    x: cardLeft + 36,
    y: cardTop < box.top ? cardTop + cardH : cardTop,
  };
  const to = {
    x: box.left + box.width * 0.55,
    y: box.top + box.height + 2,
  };
  const mid = {
    x: (from.x + to.x) / 2 + 28,
    y: (from.y + to.y) / 2,
  };
  const path = `M ${from.x} ${from.y} Q ${mid.x} ${mid.y} ${to.x} ${to.y}`;

  return createPortal(
    <div className="fixed inset-0 z-[170]" role="dialog" aria-modal="true" aria-labelledby="vaccine-hint-title">
      <button
        type="button"
        aria-label="Закрыть подсказку"
        className="absolute inset-0 cursor-default bg-transparent"
        onClick={dismiss}
      />

      <div
        className="pointer-events-none fixed z-[171] rounded-2xl"
        style={{
          left: spot.left,
          top: spot.top,
          width: spot.width,
          height: spot.height,
          boxShadow:
            "0 0 0 9999px color-mix(in srgb, var(--overlay) 68%, transparent)",
        }}
        aria-hidden
      />

      <button
        type="button"
        aria-label="Открыть карточку прививки"
        onClick={() => {
          dismiss();
          onPeek();
        }}
        className="maya-hint-ring pointer-events-auto fixed z-[172] rounded-2xl border-2 border-white/90 bg-transparent"
        style={{
          left: spot.left,
          top: spot.top,
          width: spot.width,
          height: spot.height,
        }}
      />

      <span
        className="maya-hint-tap pointer-events-none fixed z-[173] flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[var(--on-accent,#fff)] shadow-md"
        style={{
          left: box.left + box.width - 6,
          top: box.top + box.height - 8,
        }}
        aria-hidden
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M8 13v-3a2 2 0 1 1 4 0v2" strokeLinecap="round" />
          <path d="M12 12V8a2 2 0 1 1 4 0v4" strokeLinecap="round" />
          <path d="M16 12V9a2 2 0 1 1 4 0v6.5a5.5 5.5 0 0 1-9.6 3.6L8 16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <svg
        className="pointer-events-none fixed inset-0 z-[173] text-accent"
        width="100%"
        height="100%"
        aria-hidden
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          pathLength={1}
          className="maya-draw"
        />
        <path
          d={`M ${to.x - 7} ${to.y + 9} L ${to.x} ${to.y} L ${to.x + 9} ${to.y + 6}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="maya-draw-delay"
        />
      </svg>

      <div
        className="maya-panel pointer-events-auto fixed z-[174] -rotate-2 rounded-2xl border-2 border-accent/50 bg-card px-3.5 py-3 shadow-[0_18px_40px_-18px_rgba(80,30,50,0.45)]"
        style={{ left: cardLeft, top: cardTop, width: cardW }}
      >
        <p
          id="vaccine-hint-title"
          className="font-display text-[17px] font-semibold leading-snug tracking-tight text-foreground"
        >
          Нажмите — почитать о прививке
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          Плюсы, нюансы и побочки откроются в карточке.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-2.5 rounded-xl bg-accent px-3 py-1.5 text-sm font-semibold text-[var(--on-accent,#fff)]"
        >
          Понятно
        </button>
      </div>
    </div>,
    document.body,
  );
}
