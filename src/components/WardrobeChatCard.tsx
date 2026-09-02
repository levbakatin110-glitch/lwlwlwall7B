"use client";

import Link from "next/link";

export function WardrobeChatCard({
  mode,
  title,
  body,
  cta,
  className = "",
}: {
  mode: "items" | "add";
  title: string;
  body: string;
  cta: string;
  className?: string;
}) {
  return (
    <div
      className={`maya-msg-in relative overflow-hidden rounded-[1.35rem] px-3.5 py-3 text-white shadow-lg ring-1 ring-white/10 ${className}`}
      style={{
        background:
          mode === "items"
            ? "linear-gradient(160deg, #7a3d52 0%, #a85d72 48%, #c48a96 100%)"
            : "linear-gradient(160deg, #5c3d6e 0%, #8a5a9a 50%, #b889c0 100%)",
      }}
      aria-label={title}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background:
            "radial-gradient(ellipse at 85% 15%, rgba(255,255,255,0.4), transparent 55%)",
        }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none">
            <path
              d="M8 6.5 12 4l4 2.5V9l2 1.2v9.3H6V10.2L8 9V6.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M10 20.5v-5h4v5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/80">
            Одежда
          </p>
          <p className="mt-0.5 text-[15px] font-semibold leading-snug">{title}</p>
          <p className="mt-1 text-[12px] leading-snug text-white/90">{body}</p>
          <Link
            href="/wardrobe"
            className="mt-2.5 inline-flex rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-[#5c2f40] transition hover:bg-white"
          >
            {cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
