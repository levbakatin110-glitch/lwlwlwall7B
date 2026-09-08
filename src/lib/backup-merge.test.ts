import { describe, expect, it } from "vitest";
import {
  mergeBackupData,
  mergeJournalList,
  journalEntryCount,
} from "./backup-merge";

describe("mergeJournalList", () => {
  it("keeps both sides and does not drop the local entry", () => {
    const merged = mergeJournalList(
      [{ id: "a", createdAt: "2026-03-01T10:00:00Z", value: "local" }],
      [{ id: "b", createdAt: "2026-03-01T11:00:00Z", value: "cloud" }],
    );
    expect(merged.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("does not let an empty cloud wipe a filled diary", () => {
    const merged = mergeJournalList(
      [{ id: "a", createdAt: "2026-03-01T10:00:00Z", value: "keep" }],
      [],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("a");
  });
});

describe("mergeBackupData", () => {
  it("unions mom journals instead of replacing", () => {
    const out = mergeBackupData(
      {
        momJournals: {
          contractions: [{ id: "c1", createdAt: "2026-03-01T10:00:00Z" }],
        },
      },
      {
        momJournals: {
          kicks: [{ id: "k1", createdAt: "2026-03-01T11:00:00Z" }],
        },
      },
    );
    const mom = out.momJournals as Record<string, { id: string }[]>;
    expect(mom.contractions?.map((e) => e.id)).toEqual(["c1"]);
    expect(mom.kicks?.map((e) => e.id)).toEqual(["k1"]);
  });
});

describe("journalEntryCount", () => {
  it("counts nested lists", () => {
    expect(
      journalEntryCount({
        sleep: [{}, {}],
        walk: [],
      }),
    ).toBe(2);
  });
});
