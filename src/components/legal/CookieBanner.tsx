"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "maya-cookie-ok";

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "1") setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-line bg-card/95 p-4 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted">
          Продолжая пользоваться сайтом, вы соглашаетесь с использованием cookie
          и условиями{" "}
          <Link href="/legal/privacy" className="text-accent underline">
            Политики обработки персональных данных
          </Link>
          .
        </p>
        <button
          type="button"
          className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            try {
              localStorage.setItem(KEY, "1");
            } catch {
              /* ignore */
            }
            setShow(false);
          }}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
