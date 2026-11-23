"use client";

import { useEffect } from "react";

function isFormField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

/** Высота оболочки = видимый экран. Иначе снизу остаётся полоса, и список выезжает из-под неё. */
function syncVisibleHeight() {
  const vv = window.visualViewport;
  const vh = Math.round(vv?.height ?? window.innerHeight);
  const ih = Math.round(window.innerHeight);
  // Клавиатура сильно ниже экрана. Сдвиг меню и адресной строки — нет, его не запираем.
  const keyboard = ih - vh > 160;
  const h = keyboard ? vh : Math.max(vh, ih);
  const root = document.documentElement;
  const nextH = `${h}px`;
  if (root.style.getPropertyValue("--app-vh") !== nextH) {
    root.style.setProperty("--app-vh", nextH);
  }
  root.style.setProperty("--vv-top", "0px");
}

/** Сбрасывает сдвиг/зум iOS после закрытия клавиатуры на телефоне. */
export function MobileKeyboardFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    let lastHeight = vv?.height ?? window.innerHeight;

    const pin = () => {
      syncVisibleHeight();
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    const resetScroll = () => {
      requestAnimationFrame(pin);
    };

    const onResize = () => {
      const height = vv?.height ?? window.innerHeight;
      const keyboardClosed = height > lastHeight + 48;
      lastHeight = height;
      pin();
      if (keyboardClosed) resetScroll();
    };

    const onFocusOut = (e: FocusEvent) => {
      if (!isFormField(e.target)) return;
      window.setTimeout(resetScroll, 80);
    };

    const onResync = () => {
      pin();
      window.setTimeout(pin, 60);
      window.setTimeout(pin, 280);
    };

    pin();
    vv?.addEventListener("resize", onResize);
    vv?.addEventListener("scroll", pin);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", pin);
    window.addEventListener("maya-frame-resync", onResync);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      vv?.removeEventListener("resize", onResize);
      vv?.removeEventListener("scroll", pin);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", pin);
      window.removeEventListener("maya-frame-resync", onResync);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return null;
}
