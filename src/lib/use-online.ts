"use client";

import { useEffect, useState } from "react";

/** Онлайн-статус браузера/WebView. На сервере считаем online. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

export const OFFLINE_MESSAGE = "Нет интернета. Попробуйте позже.";
