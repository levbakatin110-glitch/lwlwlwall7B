import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { quarantineCorruptFile, writeFileAtomic } from "@/lib/atomic-file";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "maya-atomic-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("writeFileAtomic", () => {
  it("writes the file and leaves no temp files", () => {
    const p = join(dir, "a.json");
    writeFileAtomic(p, '{"a":1}');
    writeFileAtomic(p, '{"a":2}');
    expect(readFileSync(p, "utf8")).toBe('{"a":2}');
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("throws (does not swallow) when the target dir does not exist", () => {
    expect(() => writeFileAtomic(join(dir, "nope", "x.json"), "x")).toThrow();
  });
});

describe("quarantineCorruptFile", () => {
  it("keeps a copy of the broken file next to it", () => {
    const p = join(dir, "broken.json");
    writeFileSync(p, "{not json");
    const copy = quarantineCorruptFile(p);
    expect(copy).toBeTruthy();
    expect(readFileSync(copy as string, "utf8")).toBe("{not json");
  });
});
