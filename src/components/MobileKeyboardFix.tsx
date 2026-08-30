"use client";

import { useEffect } from "react";

function isFormField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

/** Сбрасывает сдвиг/зум iOS после закрытия клавиатуры на телефоне. */
export function MobileKeyboardFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let lastHeight = vv.height;

    const resetScroll = () => {
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.documentElement.scrollLeft = 0;
        document.body.scrollTop = 0;
        document.body.scrollLeft = 0;
      });
    };

    const onResize = () => {
      const keyboardClosed = vv.height > lastHeight + 48;
      lastHeight = vv.height;
      if (keyboardClosed) resetScroll();
    };

    const onFocusOut = (e: FocusEvent) => {
      if (!isFormField(e.target)) return;
      window.setTimeout(resetScroll, 80);
    };

    vv.addEventListener("resize", onResize);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      vv.removeEventListener("resize", onResize);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return null;
}
