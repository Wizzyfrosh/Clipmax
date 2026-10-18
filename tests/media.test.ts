import { describe, it, expect } from "vitest";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command, probe, render } from "../packages/media";
import { selectRanges, captionsFor, srt } from "../packages/contracts";
const segments = [
  { id: "0", startMs: 10000, endMs: 20000, text: "Start" },
  { id: "1", startMs: 20000, endMs: 35000, text: "Finish" },
  { id: "2", startMs: 40000, endMs: 65000, text: "Another thought" },
];
const c = {
  startId: "0",
  endId: "1",
  title: "Title",
  reason: "Reason",
  script: "Script",
  voicePrompt: "Prompt",
};
describe("source-grounded clip selection", () => {
  it("resolves timestamps from existing segment IDs", () =>
    expect(selectRanges([c], segments, 70000)[0]).toMatchObject({
      startMs: 10000,
      endMs: 35000,
    }));
  it("rejects fabricated IDs", () =>
    expect(
      selectRanges([{ ...c, startId: "invented" }], segments, 70000),
    ).toEqual([]));
  it("rejects ranges outside source bounds", () =>
    expect(selectRanges([c], segments, 30000)).toEqual([]));
  it("rejects too-short ranges", () =>
    expect(selectRanges([{ ...c, endId: "0" }], segments, 70000)).toEqual([]));
  it("deduplicates substantial overlap", () =>
    expect(selectRanges([c, c], segments, 70000)).toHaveLength(1));
  it("keeps distinct moments", () =>
    expect(
      selectRanges([c, { ...c, startId: "2", endId: "2" }], segments, 70000),
    ).toHaveLength(2));
  it("clamps and rebases captions", () =>
    expect(captionsFor(segments, 15000, 30000)).toEqual([
      { ...segments[0], startMs: 0, endMs: 5000 },
      { ...segments[1], startMs: 5000, endMs: 15000 },
    ]));
  it("formats SRT in clip-relative time", () =>
    expect(srt(captionsFor(segments, 15000, 30000))).toContain(
      "00:00:00,000 --> 00:00:05,000",
    ));
});
it("renders a real MP4 with audio in original and padded vertical formats", async () => {
  const dir = await mkdtemp(join(tmpdir(), "clipmax-test-"));
  try {
    const source = join(dir, "source.mp4");
    await command("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=640x360:rate=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=44100",
      "-t",
      "23",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-c:a",
      "aac",
      source,
    ]);
    await expect(probe(source)).rejects.toThrow("INVALID_DURATION");
    for (const layout of ["original", "vertical"]) {
      const out = join(dir, `${layout}.mp4`);
      await render(source, out, 1000, 22000, layout);
      const meta = await probe(out, undefined, 1);
      expect(meta.durationMs).toBeGreaterThan(20000);
      expect(meta.durationMs).toBeLessThan(22000);
      if (layout === "vertical")
        expect(meta).toMatchObject({ width: 404, height: 720 });
      expect((await stat(out)).size).toBeGreaterThan(1000);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 60000);
