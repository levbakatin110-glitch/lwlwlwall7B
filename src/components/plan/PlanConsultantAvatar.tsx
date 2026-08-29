import Image from "next/image";
import type { PlanConsultantId } from "@/lib/plan-consultants";
import { getPlanConsultant } from "@/lib/plan-consultants";

export function PlanConsultantAvatar({
  consultantId,
  name,
  avatar,
  size = 40,
  className = "",
}: {
  consultantId?: PlanConsultantId | string | null;
  name?: string;
  avatar?: string;
  size?: number;
  className?: string;
}) {
  const c = avatar && name ? { name, avatar } : getPlanConsultant(consultantId);
  return (
    <Image
      src={c.avatar}
      alt={c.name}
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ring-2 ring-accent/25 ${className}`}
    />
  );
}
