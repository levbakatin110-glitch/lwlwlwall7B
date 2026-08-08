"use client";

import { ModuleJournal } from "@/components/ModuleJournal";
import { use } from "react";

export default function ModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = use(params);
  return <ModuleJournal moduleId={moduleId} />;
}
