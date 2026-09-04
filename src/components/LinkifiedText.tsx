"use client";

import type { ReactNode } from "react";
import { splitLinkParts } from "@/lib/linkify-text";

/** Текст с кликабельными ссылками (WB, Ozon, сайт Маи). */
export function LinkifiedText({ text }: { text: string }): ReactNode {
  const parts = splitLinkParts(text);
  if (parts.length === 1 && parts[0]?.type === "text") return text;
  return parts.map((p, i) => {
    if (p.type === "text") return p.value;
    return (
      <a
        key={`u${i}`}
        href={p.href}
        target={p.external ? "_blank" : undefined}
        rel={p.external ? "noopener noreferrer" : undefined}
        className="break-all text-accent underline underline-offset-2"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {p.value}
      </a>
    );
  });
}
