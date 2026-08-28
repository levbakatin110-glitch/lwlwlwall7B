import Image from "next/image";
import { PLAN_MARIA_AVATAR, PLAN_TEAM_DISPLAY_NAME } from "@/lib/plan-products";

export function PlanMariaAvatar({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={PLAN_MARIA_AVATAR}
      alt={PLAN_TEAM_DISPLAY_NAME}
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ring-2 ring-accent/25 ${className}`}
    />
  );
}
