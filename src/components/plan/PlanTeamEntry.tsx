"use client";

/**
 * Вход в «План + чат» полностью выключен.
 * Продажа и чаты консультанта не используются.
 */

export type PlanTeamEntryState = {
  ready: boolean;
  visible: boolean;
  href: string | null;
};

export function pickPlanTeamTarget(
  _orders: unknown[],
): Pick<PlanTeamEntryState, "visible" | "href"> {
  return { visible: false, href: null };
}

export function usePlanTeamEntry(): PlanTeamEntryState {
  return { ready: true, visible: false, href: null };
}

export function usePlanTeamHref(): string {
  return "/";
}

export function PlanTeamFloatingButton() {
  return null;
}

export function PlanTeamCarouselLink(_props: { active: boolean }) {
  return null;
}

export function PlanTeamChatBanner() {
  return null;
}
