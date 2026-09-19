import { redirect } from "next/navigation";
import { HomeScreen } from "@/components/HomeScreen";
import { SKIP_ONBOARDING_TO_PRICING } from "@/lib/subscription";

export default function HomePage() {
  if (SKIP_ONBOARDING_TO_PRICING) {
    redirect("/pricing");
  }
  return <HomeScreen />;
}
