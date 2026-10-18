import { describe, expect, it } from "vitest";
import { command, render } from "../packages/media";

describe("media subprocess boundaries", () => {
  it("returns successful output", async () => {
    await expect(
      command(process.execPath, ["-e", "process.stdout.write('ok')"]),
    ).resolves.toBe("ok");
  });
  it("does not expose stderr from failed processes", async () => {
    await expect(
      command(process.execPath, [
        "-e",
        "console.error('private-source-path');process.exit(2)",
      ]),
    ).rejects.toThrow(/^MEDIA_FAILED_2$/);
  });
  it("reports missing executables safely", async () => {
    await expect(command("clipmax-nonexistent-executable", [])).rejects.toThrow(
      "MEDIA_SPAWN_FAILED",
    );
  });
  it("terminates processes exceeding their deadline", async () => {
    await expect(
      command(
        process.execPath,
        ["-e", "setInterval(()=>{},1000)"],
        undefined,
        100,
      ),
    ).rejects.toThrow("MEDIA_TIMEOUT");
  });
  it("rejects already-cancelled work before spawning", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      command("clipmax-nonexistent-executable", [], controller.signal),
    ).rejects.toThrow("MEDIA_CANCELLED");
  });
  it("terminates active work on cancellation", async () => {
    const controller = new AbortController();
    const result = command(
      process.execPath,
      ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],
      controller.signal,
    );
    const timer = setTimeout(() => controller.abort(), 150);
    try {
      await expect(result).rejects.toThrow("MEDIA_CANCELLED");
    } finally {
      clearTimeout(timer);
    }
  });
  it("bounds subprocess output", async () => {
    await expect(
      command(process.execPath, [
        "-e",
        "process.stdout.write('x'.repeat(2000001))",
      ]),
    ).rejects.toThrow("MEDIA_OUTPUT_LIMIT");
  });
});

describe("render input boundaries", () => {
  it.each([
    [-1, 21000],
    [0, 19999],
    [0, 60001],
    [0.5, 21000],
    [NaN, 21000],
    [0, Infinity],
  ])(
    "rejects invalid range %s to %s before opening files",
    async (start, end) => {
      await expect(
        render("missing-input", "unused-output", start, end, "original"),
      ).rejects.toThrow("INVALID_RANGE");
    },
  );
  it("rejects unknown layouts", async () => {
    await expect(
      render("missing-input", "unused-output", 0, 20000, "unknown"),
    ).rejects.toThrow("INVALID_LAYOUT");
  });
});
