"use client";

import { useEffect, useState } from "react";

/** true после простоя главного потока — чтобы не грузить лишний JS на первом кадре телефона. */
export function useIdleReady(timeoutMs = 1400) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => setReady(true), {
        timeout: timeoutMs,
      });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setReady(true), Math.min(400, timeoutMs));
    return () => window.clearTimeout(t);
  }, [timeoutMs]);

  return ready;
}
