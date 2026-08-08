/** Ручные SVG-скетчи для атмосферы Маи — розовый ink, не emoji. */

type SketchProps = {
  className?: string;
  /** blush | ink — цвет через currentColor или accent */
  tone?: "accent" | "muted" | "soft";
};

function toneClass(tone: SketchProps["tone"] = "accent") {
  if (tone === "muted") return "text-muted/45";
  if (tone === "soft") return "text-accent/35";
  return "text-accent";
}

/** Портрет Маи — мягкий скетч */
export function SketchMaya({ className = "", tone }: SketchProps) {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${toneClass(tone)} ${className}`}
      aria-hidden
    >
      {/* волосы / ореол */}
      <path
        d="M42 78c2-28 22-48 40-50 20-2 40 14 44 42 2 14-2 28-10 38"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        pathLength={1}
        className="maya-draw"
      />
      <path
        d="M48 70c6-18 20-28 34-28s28 12 32 30"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
        pathLength={1}
      />
      {/* лицо */}
      <ellipse
        cx="80"
        cy="82"
        rx="34"
        ry="38"
        stroke="currentColor"
        strokeWidth="2.2"
        pathLength={1}
        className="maya-draw-delay"
      />
      {/* глаза */}
      <path d="M64 78c2 4 6 5 10 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M86 78c2 4 6 5 10 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="68" cy="80" r="2.2" fill="currentColor" />
      <circle cx="92" cy="80" r="2.2" fill="currentColor" />
      {/* румянец */}
      <ellipse cx="58" cy="92" rx="7" ry="4" fill="currentColor" opacity="0.18" />
      <ellipse cx="102" cy="92" rx="7" ry="4" fill="currentColor" opacity="0.18" />
      {/* улыбка */}
      <path
        d="M68 98c4 8 16 10 24 1"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {/* плечи */}
      <path
        d="M40 138c8-18 22-28 40-28s32 10 40 28"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* сердечко-заколка */}
      <path
        d="M98 48c2-4 8-4 8 1 0 5-8 10-8 10s-8-5-8-10c0-5 6-5 8-1z"
        fill="currentColor"
        opacity="0.55"
        className="maya-float"
      />
    </svg>
  );
}

/** Малыш в облачке */
export function SketchBaby({ className = "", tone }: SketchProps) {
  return (
    <svg
      viewBox="0 0 140 120"
      fill="none"
      className={`${toneClass(tone)} ${className}`}
      aria-hidden
    >
      <path
        d="M28 78c-10 0-16-10-12-18 2-6 8-8 12-6 0-12 10-22 24-22 8 0 14 3 18 8 4-10 16-16 28-12 10 4 14 14 12 22 6-2 14 2 14 12 0 12-10 18-22 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="maya-draw"
      />
      <circle cx="70" cy="62" r="22" stroke="currentColor" strokeWidth="2" />
      <circle cx="62" cy="60" r="2" fill="currentColor" />
      <circle cx="78" cy="60" r="2" fill="currentColor" />
      <path d="M64 70c3 4 9 4 12 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M48 88c6 10 18 14 32 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M22 42c4-2 8 2 6 6M112 38c-3-3-8 0-6 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
        className="maya-twinkle"
      />
    </svg>
  );
}

/** Ветка / ботаника */
export function SketchSprig({ className = "", tone }: SketchProps) {
  return (
    <svg
      viewBox="0 0 80 120"
      fill="none"
      className={`${toneClass(tone)} ${className}`}
      aria-hidden
    >
      <path
        d="M40 112c2-28 4-52-6-78"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="maya-draw"
      />
      <path
        d="M34 50c-12-2-18-14-14-22 10 2 16 10 16 18z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M38 68c12-4 20-2 24 8-10 4-18 2-24-4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M36 88c-14 0-20-10-16-18 12 0 18 8 18 14z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="34" r="3" fill="currentColor" opacity="0.35" className="maya-float" />
    </svg>
  );
}

/** Луна и звёзды — сон */
export function SketchMoon({ className = "", tone }: SketchProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={`${toneClass(tone)} ${className}`}
      aria-hidden
    >
      <path
        d="M62 22c-18 2-32 18-30 38 2 18 18 32 36 30-14-6-22-22-18-38 2-10 8-18 12-30z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        className="maya-draw"
      />
      <path
        d="M72 28l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z"
        fill="currentColor"
        opacity="0.45"
        className="maya-twinkle"
      />
      <path
        d="M28 58l1.5 3.5 3.5.5-2.5 2.5.5 3.5-3-2-3 2 .5-3.5-2.5-2.5 3.5-.5z"
        fill="currentColor"
        opacity="0.35"
        className="maya-twinkle-delay"
      />
      <circle cx="22" cy="36" r="1.8" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/** Каракули сердечек / закорючки вокруг чата */
export function SketchDoodles({ className = "", tone }: SketchProps) {
  return (
    <svg
      viewBox="0 0 320 80"
      fill="none"
      className={`${toneClass(tone)} ${className}`}
      aria-hidden
    >
      <path
        d="M20 40c8-18 28-18 32 0 4 18-16 28-16 28S16 58 20 40z"
        stroke="currentColor"
        strokeWidth="1.8"
        className="maya-draw"
      />
      <path
        d="M70 52c10-4 18 6 10 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M120 28c20 0 24 24 4 32-12 4-20-8-12-16 4-4 10-4 14 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M180 44c0-12 16-18 24-8 6 8-2 18-12 20"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M230 30l4 8 8 2-6 6 2 8-8-4-8 4 2-8-6-6 8-2z"
        stroke="currentColor"
        strokeWidth="1.4"
        className="maya-twinkle"
      />
      <path
        d="M280 50c12-16 28-6 24 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="maya-draw-delay"
      />
    </svg>
  );
}

/** Фон-пятна для пустого чата */
export function SketchBackdrop({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <SketchSprig
        tone="soft"
        className="absolute -left-2 top-6 h-28 w-20 opacity-70 maya-drift"
      />
      <SketchMoon
        tone="soft"
        className="absolute -right-1 top-10 h-24 w-24 opacity-80 maya-float"
      />
      <SketchBaby
        tone="soft"
        className="absolute bottom-8 right-4 h-28 w-32 opacity-60 maya-drift-delay"
      />
      <div className="maya-ink-splatter absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full opacity-40" />
    </div>
  );
}

/** Уголок скетча для сайдбара / ленты */
export function SketchCorner({ className = "", tone }: SketchProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={`${toneClass(tone)} ${className}`}
      aria-hidden
    >
      <path
        d="M8 48c4-20 16-32 36-36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="maya-draw"
      />
      <path
        d="M44 16c6 2 10 8 8 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M18 40c-2-6 2-12 8-12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx="48" cy="20" r="2.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
