import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { normalizeEmail } from "@/lib/email-codes";
import type { JournalEntry } from "@/lib/types";
import type { PlanTopic } from "@/lib/plan-products";
import { PLAN_TOPIC_MODULE } from "@/lib/plan-products";

const DATA_DIR = join(process.cwd(), "data", "backups");

function fileFor(email: string) {
  const key = createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex")
    .slice(0, 24);
  return join(DATA_DIR, `${key}.json`);
}

type BackupRoot = {
  v?: number;
  email?: string;
  savedAt?: string;
  data?: {
    childSpaces?: Record<
      string,
      { journals?: Record<string, JournalEntry[]> }
    >;
    activeChildId?: string;
    children?: { id: string; name: string }[];
  };
};

export function readUserBackup(email: string): BackupRoot | null {
  try {
    const path = fileFor(email);
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
  const moduleId = PLAN_TOPIC_MODULE[topic];
  const spaces = backup.data.childSpaces;
  const id =
    childId && spaces[childId]
      ? childId
      : backup.data.activeChildId && spaces[backup.data.activeChildId]
        ? backup.data.activeChildId
        : Object.keys(spaces)[0];
  if (!id) return [];
  const entries = spaces[id]?.journals?.[moduleId] ?? [];
  return [...entries].sort((a, b) => {
    const da = `${a.date}T${a.createdAt ?? "00:00"}`;
    const db = `${b.date}T${b.createdAt ?? "00:00"}`;
    return db.localeCompare(da);
  });
}
