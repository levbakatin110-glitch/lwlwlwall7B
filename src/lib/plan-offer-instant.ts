const STORAGE_KEY = "maya-plan-offer-instant";

/** Тест оффера без ожидания 2 дней: ?planOffer=1 или NEXT_PUBLIC_PLAN_OFFER_INSTANT=true */
export function readPlanOfferInstant(): boolean {
  if (process.env.NEXT_PUBLIC_PLAN_OFFER_INSTANT === "true") return true;
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function enablePlanOfferInstantFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("planOffer") === "1" || q.get("planOffer") === "instant") {
      sessionStorage.setItem(STORAGE_KEY, "1");
      q.delete("planOffer");
      const next = `${window.location.pathname}${
        q.toString() ? `?${q}` : ""
      }${window.location.hash}`;
      window.history.replaceState(null, "", next);
      return true;
    }
  } catch {
    /* ignore */
  }
  return readPlanOfferInstant();
}
