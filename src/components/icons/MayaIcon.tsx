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
      <path d="M5 18h14" />
      <path d="M7 15.5 10.5 10l3 3 4.5-7" />
      <path d="M15 6.5h3.5V10" />
    </>
  ),
  feeding: (
    <>
      <path d="M9 7.5c0-1.5 1.3-2.8 3-2.8s3 1.3 3 2.8v2.2H9V7.5Z" />
      <path d="M8.2 9.7h7.6v7.8a2 2 0 0 1-2 2h-3.6a2 2 0 0 1-2-2V9.7Z" />
      <path d="M10 14.5h4" />
    </>
  ),
  formula: (
    <>
      <path d="M8.5 5.5h7v2.2l-1.2 1.5v9.3a1.5 1.5 0 0 1-1.5 1.5h-1.6a1.5 1.5 0 0 1-1.5-1.5V9.2L8.5 7.7V5.5Z" />
      <path d="M9.5 7.7h5" />
    </>
  ),
  solids: (
    <>
      <path d="M6.5 10.5h11l-1.2 7.2a2 2 0 0 1-2 1.8H9.7a2 2 0 0 1-2-1.8L6.5 10.5Z" />
      <path d="M9 8.2c0-1.6 1.3-2.7 3-2.7s3 1.1 3 2.7" />
    </>
  ),
  outfit: (
    <>
      <path d="M9 5.5 12 7.2 15 5.5l3 2.2-2.2 2.5V19H8.2v-8.8L6 7.7l3-2.2Z" />
    </>
  ),
  sleep: (
    <>
      <path d="M14.5 6.5A6.5 6.5 0 1 0 18 15.2 5.2 5.2 0 0 1 14.5 6.5Z" />
    </>
  ),
  vaccines: (
    <>
      <path d="M14.8 4.8 19.2 9.2" />
      <path d="M13.4 6.2 17.8 10.6" />
      <path d="M15.5 8.9 8.2 16.2a2 2 0 0 1-2.8 0l-.6-.6a2 2 0 0 1 0-2.8L12.1 5.5" />
      <path d="M5 19l2.2-2.2" />
    </>
  ),
  health: (
    <>
      <path d="M12 19s-6.5-4.1-6.5-9A3.8 3.8 0 0 1 12 8.2 3.8 3.8 0 0 1 18.5 10c0 4.9-6.5 9-6.5 9Z" />
    </>
  ),
  diet: (
    <>
      <path d="M7 5.5v13M7 8.5h3.5a2.5 2.5 0 0 0 0-5H7" />
      <path d="M15.5 5.5v13M14 5.5h3l1.5 5.5H14" />
    </>
  ),
  water: (
    <>
      <path d="M12 4.5c0 0-5.5 6.2-5.5 10.2a5.5 5.5 0 0 0 11 0C17.5 10.7 12 4.5 12 4.5Z" />
      <path d="M9.2 14.2c.6 1.4 1.8 2.2 2.8 2.2" />
    </>
  ),
  walk: (
    <>
      <circle cx="14.5" cy="6.2" r="1.8" />
      <path d="M13.2 8.8 11 12.2l-2.2 1.2M11 12.2l1.8 2.2 2.5-.4M8.8 13.4 7 19M12.8 14.4 14.2 19" />
    </>
  ),
  diaper: (
    <>
      <path d="M5.5 8.5h13v3.2c0 4.2-2.6 7.3-6.5 7.3S5.5 15.9 5.5 11.7V8.5Z" />
      <path d="M5.5 8.5c1.2-1.5 3.2-2.2 6.5-2.2s5.3.7 6.5 2.2" />
      <path d="M9 14.5h6" />
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
      <circle cx="12" cy="12" r="8.2" />
      <path d="M10.2 8.6v6.8L16.6 12 10.2 8.6z" fill="currentColor" stroke="none" />
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
      strokeWidth="1.7"
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
