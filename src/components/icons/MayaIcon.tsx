import type { ReactNode, SVGProps } from "react";
import { normalizeIconName, type IconName } from "@/lib/icons";

export type { IconName };
export { ICON_NAMES, isIconName, normalizeIconName } from "@/lib/icons";

const paths: Record<IconName, ReactNode> = {
  chat: (
    <>
      <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16H11l-3.2 2.4A.6.6 0 0 1 7 18V16H7.5A2.5 2.5 0 0 1 5 13.5v-6Z" />
      <path d="M9 9.5h6M9 12.5h4" strokeWidth="1.5" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="9" r="3.2" />
      <path d="M5.5 19c1.4-3 3.7-4.5 6.5-4.5S16.1 16 17.5 19" />
    </>
  ),
  wardrobe: (
    <>
      <path d="M8 5.5h8l1.5 3.2V19a1 1 0 0 1-1 1H7.5a1 1 0 0 1-1-1V8.7L8 5.5Z" />
      <path d="M12 5.5V20M9.2 9.2h5.6" />
    </>
  ),
  moments: (
    <>
      <rect x="4.5" y="6.5" width="15" height="12" rx="2" />
      <circle cx="9" cy="11" r="1.6" />
      <path d="M7.5 17.5 11 14l2.2 2.2 2.3-3 3 4.3" />
    </>
  ),
  memory: (
    <>
      <path d="M8 7.5h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
      <path d="M9.5 5.5h5M10 11h4M10 14h2.5" />
    </>
  ),
  growth: (
    <>
      <path d="M5 19h14" />
      <path d="M8 19V12" />
      <path d="M12 19V8" />
      <path d="M16 19V5.5" />
    </>
  ),
  feeding: (
    <>
      <circle cx="8.4" cy="8.2" r="2.4" />
      <path d="M6.6 11.4c.4 4 2.8 6.6 6.2 6.6 3.8 0 6.4-2.6 6.4-6.2 0-2.4-1.4-4.2-3.6-4.8" />
    </>
  ),
  formula: (
    <>
      <path d="M10 4h4v2.4l.8 1.2V8H9.2V7.6L10 6.4V4Z" />
      <path d="M9.2 8h5.6v10.2c0 1-.8 1.8-1.8 1.8h-2c-1 0-1.8-.8-1.8-1.8V8Z" />
    </>
  ),
  solids: (
    <>
      <path d="M4.8 12h14.4s-.6 7.2-7.2 7.2S4.8 12 4.8 12Z" />
      <path d="M8.5 8.2c1.2 1.2 2.3 1.2 3.5 0 1.2 1.2 2.3 1.2 3.5 0" />
      <path d="M17.8 7.2 14.6 11" />
    </>
  ),
  outfit: (
    <>
      <path d="M9 4.8 12 6.6 15 4.8l2.8 2.2-1.8 2.4v3.2H15V19H9v-6.4H8V9.4L6.2 7 9 4.8Z" />
    </>
  ),
  belly: (
    <>
      <circle cx="12" cy="5.2" r="2.05" />
      <path d="M9.4 8.4c.7-.3 1.6-.5 2.6-.5s1.9.2 2.6.5" />
      <path d="M7.8 10.2c.3 3.4 1.8 6.2 4.2 8 2.4-1.8 3.9-4.6 4.2-8" />
      <path d="M8.4 13.4c1.1 1.6 2.3 2.4 3.6 2.4s2.5-.8 3.6-2.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="4.5" y="6.5" width="15" height="13.5" rx="2" />
      <path d="M8 4.6v3.6M16 4.6v3.6M4.5 10.2h15" />
      <path d="M8.2 13.4h2.2M13.6 13.4h2.2M8.2 16.8h2.2" />
    </>
  ),
  wave: (
    <>
      <path d="M3.2 16.2c1.8 0 2.2-8.4 4.4-8.4s2.6 8.4 4.4 8.4 2.2-8.4 4.4-8.4 2.6 8.4 4.4 8.4" />
    </>
  ),
  kick: (
    <>
      <ellipse cx="10.8" cy="14.4" rx="4" ry="5.2" />
      <circle cx="13.8" cy="7.2" r="1.35" />
      <circle cx="16.4" cy="8.8" r="1.2" />
      <circle cx="11.4" cy="6.6" r="1.35" />
      <circle cx="17.6" cy="11.2" r="1.05" />
    </>
  ),
  thermo: (
    <>
      <path d="M10.2 4.4h3.6v10.4a3.6 3.6 0 1 1-3.6 0V4.4Z" />
      <path d="M12 8v6.4" />
    </>
  ),
  clinic: (
    <>
      <path d="M5.2 20V9.2L12 5.2l6.8 4V20" />
      <path d="M10 20v-5.2h4V20" />
      <path d="M12 10v3.6M10.2 11.8h3.6" />
    </>
  ),
  pills: (
    <>
      <path d="M5.8 8.4c-1.5 1.5-1.5 3.8 0 5.3s3.8 1.5 5.3 0l2.8-2.8c1.5-1.5 1.5-3.8 0-5.3s-3.8-1.5-5.3 0L5.8 8.4Z" />
      <path d="M7.2 12.4 11 8.6" />
      <circle cx="16.6" cy="14.6" r="3.3" />
    </>
  ),
  clipboard: (
    <>
      <path d="M7 6.6h10a1.6 1.6 0 0 1 1.6 1.6v11.2a1.6 1.6 0 0 1-1.6 1.6H7a1.6 1.6 0 0 1-1.6-1.6V8.2A1.6 1.6 0 0 1 7 6.6Z" />
      <path d="M9.2 6.6V5.3A1.2 1.2 0 0 1 10.4 4.1h3.2A1.2 1.2 0 0 1 14.8 5.3V6.6" />
      <path d="M8.6 11.4h6.8M8.6 14.4h6.8M8.6 17.4h4.4" />
    </>
  ),
  cycle: (
    <>
      <path d="M7.2 6.2A7.2 7.2 0 1 1 5.6 8.4" />
      <path d="M5.4 4.8v3.4H8.8" />
      <path d="M13.4 9.4a3.4 3.4 0 1 0 2.2 5.8 2.6 2.6 0 0 1-2.2-5.8Z" />
    </>
  ),
  sleep: (
    <>
      <path d="M13.5 5A7 7 0 1 0 19 14.2 5.6 5.6 0 0 1 13.5 5Z" />
    </>
  ),
  vaccines: (
    <>
      <path d="M4.8 8.2v3.6" />
      <path d="M3.6 8.2h2.4M3.6 11.8h2.4" />
      <path d="M6 10h9.2" />
      <rect x="6.2" y="7.6" width="9.4" height="4.8" rx="1" />
      <path d="M15.6 10H21" />
    </>
  ),
  health: (
    <>
      <path d="M12 19.2S5 14.4 5 9.8A3.9 3.9 0 0 1 12 8.1 3.9 3.9 0 0 1 19 9.8c0 4.6-7 9.4-7 9.4Z" />
    </>
  ),
  diet: (
    <>
      <path d="M12 20.2c-4.2 0-6.8-3.2-6.8-7.2 0-3.4 2.6-6.6 6.8-8.8 4.2 2.2 6.8 5.4 6.8 8.8 0 4-2.6 7.2-6.8 7.2Z" />
      <path d="M12 4.2v3.2" />
    </>
  ),
  water: (
    <>
      <path d="M12 3.8s-5.6 6.6-5.6 10.4a5.6 5.6 0 0 0 11.2 0C17.6 10.4 12 3.8 12 3.8Z" />
    </>
  ),
  walk: (
    <>
      <path d="M5.8 8.2h3.4" />
      <path d="M7.5 8.2v8" />
      <path d="M7.5 11.2h9.2l-1.2 5.4H9.2z" />
      <circle cx="10" cy="18.2" r="1.8" />
      <circle cx="16.2" cy="18.2" r="1.8" />
    </>
  ),
  diaper: (
    <>
      <path d="M6.2 7.2h11.6l1.4 3.4v2.6c0 3.2-2.4 6-7.2 6s-7.2-2.8-7.2-6V10.6l1.4-3.4Z" />
      <path d="M8.8 13.8h6.4" />
    </>
  ),
  drop: (
    <>
      <path d="M12 4.6s5.4 6.6 5.4 10.4A5.4 5.4 0 1 1 6.6 15C6.6 11.2 12 4.6 12 4.6Z" />
    </>
  ),
  poop: (
    <>
      <path d="M12.6 3.2c2.1 0 3.4 1.7 2.9 3.4-.3 1.2-1.5 1.8-2.7 1.6" />
      <path d="M7.6 9.4c-2.1.6-3.4 2.4-3.1 4.4.2 1.3 1.2 2.3 2.6 2.7" />
      <path d="M16.9 16.5c1.4-.4 2.4-1.4 2.6-2.7.3-2-1-3.8-3.1-4.4" />
      <path d="M7.4 16.2c1.4-2.2 3.3-3.2 4.6-3.2s3.2 1 4.6 3.2" />
      <path d="M4.8 17.2c-1.2 1.4-1.2 3.4.2 4.8 1.3 1.3 3.6 2.2 7 2.2s5.7-.9 7-2.2c1.4-1.4 1.4-3.4.2-4.8" />
      <circle cx="9.5" cy="18.6" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="18.6" r="0.95" fill="currentColor" stroke="none" />
      <path d="M10 20.4c1.2.75 2.8.75 4 0" />
    </>
  ),
  check: (
    <>
      <path d="M5.6 12.4 10 16.8 18.4 7.6" />
    </>
  ),
  notes: (
    <>
      <path d="M7 5.5h7.5L17.5 8v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V7A1.5 1.5 0 0 1 7 5.5Z" />
      <path d="M14.5 5.5V8H17.5M8.5 12h7M8.5 15h5" />
    </>
  ),
  spark: (
    <>
      <path d="M12 4.5v3.2M12 16.3v3.2M4.5 12h3.2M16.3 12h3.2" />
      <path d="M7.2 7.2 9.4 9.4M14.6 14.6l2.2 2.2M16.8 7.2 14.6 9.4M9.4 14.6l-2.2 2.2" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
  sport: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M5.5 9.5c2 .8 4.2 1.2 6.5 1.2s4.5-.4 6.5-1.2M5.5 14.5c2-.8 4.2-1.2 6.5-1.2s4.5.4 6.5 1.2M12 4.5v15" />
    </>
  ),
  work: (
    <>
      <rect x="4.5" y="8" width="15" height="10.5" rx="1.8" />
      <path d="M9 8V6.8A1.3 1.3 0 0 1 10.3 5.5h3.4A1.3 1.3 0 0 1 15 6.8V8M4.5 12.5h15" />
    </>
  ),
  study: (
    <>
      <path d="M4.5 8.5 12 5.5l7.5 3-7.5 3-7.5-3Z" />
      <path d="M7.2 10.2v4.6c0 .7 2.1 2.2 4.8 2.2s4.8-1.5 4.8-2.2v-4.6M19.5 8.8v6.2" />
    </>
  ),
  pulse: (
    <>
      <path d="M3.5 12h4l2-5 3 10 2.5-5H20.5" />
    </>
  ),
  list: (
    <>
      <path d="M9 7.5h9M9 12h9M9 16.5h9" />
      <circle cx="6" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="16.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  circle: (
    <>
      <path d="M4.6 8.2h8.2a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1-1.8 1.8H8.6L6.2 17.6v-2.4H4.6A1.8 1.8 0 0 1 2.8 13.4V10a1.8 1.8 0 0 1 1.8-1.8Z" />
      <path d="M11.4 5.6h8a1.8 1.8 0 0 1 1.8 1.8v3.2a1.8 1.8 0 0 1-1.4 1.8" />
    </>
  ),
  videonote: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M10.2 8.6v6.8L16.6 12 10.2 8.6z" fill="currentColor" stroke="none" />
    </>
  ),
  mic: (
    <>
      <path d="M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3Z" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3.5" />
    </>
  ),
  close: (
    <>
      <path d="M7 7l10 10M17 7 7 17" />
    </>
  ),
  edit: (
    <>
      <path d="M5 19h4l10-10-4-4L5 15v4Z" />
      <path d="m13 7 4 4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 6v12M6 12h12" />
    </>
  ),
  bell: (
    <>
      <path d="M6.2 16.5h11.6c-.6-1-1.3-2.2-1.3-4.2V10a4.5 4.5 0 1 0-9 0v2.3c0 2-.7 3.2-1.3 4.2Z" />
      <path d="M10 16.5v.7a2 2 0 0 0 4 0v-.7" />
    </>
  ),
};

type Props = SVGProps<SVGSVGElement> & {
  name: IconName | string;
  size?: number;
};

export function MayaIcon({ name, size = 18, className = "", ...rest }: Props) {
  const key = normalizeIconName(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
      {...rest}
    >
      {paths[key]}
    </svg>
  );
}

export function IconBadge({
  name,
  className = "",
}: {
  name: IconName | string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft/80 text-accent ${className}`}
    >
      <MayaIcon name={name} size={18} />
    </span>
  );
}
