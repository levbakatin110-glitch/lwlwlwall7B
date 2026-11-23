"use client";

import { MomsCircleChat } from "@/components/MomsCircleChat";
import { OfflineGate } from "@/components/OfflineNotice";

export default function CommunityPage() {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      <OfflineGate>
        <MomsCircleChat />
      </OfflineGate>
    </div>
  );
}
