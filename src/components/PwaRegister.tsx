"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // localhost тоже ок — Chrome разрешает SW без HTTPS
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
