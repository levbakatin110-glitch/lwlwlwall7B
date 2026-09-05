import { describe, expect, it } from "vitest";
import { islandElapsedSec, type IslandTarget } from "@/lib/live-timer-actions";
import { formatDuration } from "@/lib/diary-day";
import { buildQuietLoopWav } from "@/lib/quiet-loop-wav";

describe("islandElapsedSec", () => {
  const base: IslandTarget = {
    id: "sleep",
    title: "Дневной сон",
    href: "/m/sleep",
    startedAt: 1_000_000,
    elapsedOffsetSec: 0,
  };

  it("counts from startedAt", () => {
    expect(islandElapsedSec(base, 1_000_000 + 82_000)).toBe(82);
  });

  it("adds breastfeeding offset", () => {
    expect(
      islandElapsedSec({ ...base, elapsedOffsetSec: 60 }, 1_000_000 + 5_000),
    ).toBe(65);
  });
});

describe("formatDuration for island clock", () => {
  it("matches Dynamic Island style after an hour", () => {
    expect(formatDuration(1 * 3600 + 22 * 60 + 34)).toBe("1:22:34");
  });
});

describe("buildQuietLoopWav", () => {
  it("writes a RIFF wave", async () => {
    const blob = buildQuietLoopWav();
    const buf = new Uint8Array(await blob.arrayBuffer());
    const ascii = String.fromCharCode(...buf.slice(0, 4));
    expect(ascii).toBe("RIFF");
    expect(blob.type).toBe("audio/wav");
    expect(buf.byteLength).toBeGreaterThan(44);
  });
});
