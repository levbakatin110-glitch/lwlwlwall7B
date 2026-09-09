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

describe("mergeBackupData children", () => {
  it("does not let an empty desktop child hide a filled phone diary", () => {
    const out = mergeBackupData(
      {
        children: [{ id: "phone", name: "Лея", birthDate: "2025-01-01" }],
        activeChildId: "phone",
        childSpaces: {
          phone: {
            journals: { sleep: [{ id: "s1", createdAt: "2026-03-01T10:00:00Z" }] },
          },
        },
      },
      {
        children: [{ id: "pc", name: "" }],
        activeChildId: "pc",
        childSpaces: { pc: { journals: { sleep: [] } } },
      },
    );
    expect(out.activeChildId).toBe("phone");
    const spaces = out.childSpaces as Record<
      string,
      { journals?: { sleep?: { id: string }[] } }
    >;
    expect(spaces.phone?.journals?.sleep?.map((e) => e.id)).toEqual(["s1"]);
  });

  it("merges the same child when ids differ but name matches", () => {
    const out = mergeBackupData(
      {
        children: [{ id: "phone", name: "Лея", birthDate: "2025-01-01" }],
        activeChildId: "phone",
        childSpaces: {
          phone: {
            journals: { diaper: [{ id: "d1", createdAt: "2026-03-01T10:00:00Z" }] },
          },
        },
      },
      {
        children: [{ id: "pc", name: "Лея", birthDate: "2025-01-01" }],
        activeChildId: "pc",
        childSpaces: {
          pc: {
            journals: { sleep: [{ id: "s1", createdAt: "2026-03-01T11:00:00Z" }] },
          },
        },
      },
    );
    expect(out.activeChildId).toBe("phone");
    const children = out.children as { id: string }[];
    expect(children.map((c) => c.id)).toEqual(["phone"]);
    const spaces = out.childSpaces as Record<
      string,
      { journals?: Record<string, { id: string }[]> }
    >;
    expect(spaces.phone?.journals?.diaper?.map((e) => e.id)).toEqual(["d1"]);
    expect(spaces.phone?.journals?.sleep?.map((e) => e.id)).toEqual(["s1"]);
    expect(spaces.pc).toBeUndefined();
  });
});
