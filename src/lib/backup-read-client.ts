import type { JournalEntry } from "@/lib/types";
import type { PlanTopic } from "@/lib/plan-products";
import { FEED_MODULE_IDS, PLAN_TOPIC_MODULE } from "@/lib/plan-products";

function sortEntries(entries: JournalEntry[]) {
  return [...entries].sort((a, b) => {
    const da = `${a.date}T${a.createdAt ?? "00:00"}`;
    const db = `${b.date}T${b.createdAt ?? "00:00"}`;
    return db.localeCompare(da);
  });
}

function entriesFromSpaceJournals(
  journals: Record<string, JournalEntry[]>,
  topic: PlanTopic,
): JournalEntry[] {
  if (topic === "sleep") {
    return sortEntries(journals[PLAN_TOPIC_MODULE.sleep] ?? []);
  }
  const all: JournalEntry[] = [];
  for (const id of FEED_MODULE_IDS) {
    all.push(...(journals[id] ?? []));
  }
  return sortEntries(all);
}

/** С клиента: все модули кормления в одну тему */
export function clientEntriesForTopic(
  journals: Record<string, JournalEntry[]>,
  topic: PlanTopic,
): JournalEntry[] {
  return entriesFromSpaceJournals(journals, topic);
}

export { sortEntries, entriesFromSpaceJournals };
