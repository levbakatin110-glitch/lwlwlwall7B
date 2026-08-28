import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { normalizeEmail } from "@/lib/email-codes";
import type { JournalEntry } from "@/lib/types";
import type { PlanTopic } from "@/lib/plan-products";
import {
  entriesFromSpaceJournals,
  sortEntries,
} from "@/lib/backup-read-client";

const DATA_DIR = join(process.cwd(), "data", "backups");

function backupFileFor(email: string) {
  const key = createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex")
    .slice(0, 24);
  return join(DATA_DIR, `${key}.json`);
}

type BackupRoot = {
  data?: {
    childSpaces?: Record<
      string,
      { journals?: Record<string, JournalEntry[]> }
    >;
    activeChildId?: string;
  };
};

export function readUserBackup(email: string): BackupRoot | null {
  try {
    const path = backupFileFor(email);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as BackupRoot;
  } catch {
    return null;
  }
}

export function diaryEntriesFromBackup(
  email: string,
  topic: PlanTopic,
  childId?: string,
): JournalEntry[] {
  const backup = readUserBackup(email);
  if (!backup?.data?.childSpaces) return [];
  const spaces = backup.data.childSpaces;
  const id =
    childId && spaces[childId]
      ? childId
      : backup.data.activeChildId && spaces[backup.data.activeChildId]
        ? backup.data.activeChildId
        : Object.keys(spaces)[0];
  if (!id) return [];
  return entriesFromSpaceJournals(spaces[id]?.journals ?? {}, topic);
}

export function mergeDiaryEntries(
  email: string,
  topic: PlanTopic,
  childId: string | undefined,
  clientEntries?: JournalEntry[],
): {
  capturedAt: string;
  entries: JournalEntry[];
  source: "client" | "backup" | "merged";
} {
  const fromBackup = diaryEntriesFromBackup(email, topic, childId);
  const client = clientEntries ?? [];
  const byId = new Map<string, JournalEntry>();
  for (const e of fromBackup) byId.set(e.id, e);
  for (const e of client) byId.set(e.id, e);
  const entries = sortEntries([...byId.values()]);
  let source: "client" | "backup" | "merged" = "backup";
  if (client.length && fromBackup.length) source = "merged";
  else if (client.length) source = "client";
  return { capturedAt: new Date().toISOString(), entries, source };
}
