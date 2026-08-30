"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Listener = (message: string) => void;

const listeners = new Set<Listener>();

const DEFAULT_MSG = "Сначала оформите подписку";

/** Показать всплывающую подсказку про оплату */
export function showPaywallHint(message = DEFAULT_MSG) {
  listeners.forEach((fn) => fn(message));
}

/**
 * Тост сверху: «сначала оплатите».
 */
export function PaywallHintHost() {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let hideTimer: number | undefined;
    let clearTimer: number | undefined;

    const onMsg: Listener = (msg) => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
      setMessage(msg);
      setVisible(true);
      hideTimer = window.setTimeout(() => setVisible(false), 2800);
      clearTimer = window.setTimeout(() => setMessage(null), 3200);
    };

    listeners.add(onMsg);
    return () => {
      listeners.delete(onMsg);
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
    };
  }, []);

  if (!mounted || !message) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[300] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto max-w-sm rounded-2xl border border-accent/30 bg-card px-4 py-3 text-center text-sm font-medium text-foreground shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] transition duration-300 ${
          visible
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0"
        }`}
      >
        {message}
      </div>
    </div>,
    document.body,
  );
}
