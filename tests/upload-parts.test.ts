import { describe, it, expect, vi, afterEach } from "vitest";
import { limits, storageConfigured } from "../src/lib/config";
import { uploadedPartNumbers, verifiedUploadedParts } from "../src/lib/upload-parts";

afterEach(() => vi.unstubAllEnvs());

describe("R2 upload admission controls", () => {
  it("does not mark storage ready with partial credentials", () => {
    for (const key of ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
      vi.stubEnv(key, "");
    }
    expect(storageConfigured()).toBe(false);
    vi.stubEnv("R2_ENDPOINT", "https://test.r2.cloudflarestorage.com");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-id");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
    expect(storageConfigured()).toBe(false);
    vi.stubEnv("R2_BUCKET", "clipmax-private");
    expect(storageConfigured()).toBe(true);
    vi.stubEnv("R2_BUCKET", " ");
    expect(storageConfigured()).toBe(false);
  });
});

describe("multipart upload recovery", () => {
  const partSize = limits.partSize;
  const size = partSize * 2 + 157;
  const parts = [
    { PartNumber: 1, Size: partSize, ETag: '"first"' },
    { PartNumber: 2, Size: partSize, ETag: '"second"' },
    { PartNumber: 3, Size: 157, ETag: '"third"' },
  ];

  it("accepts complete exact-size sequential ETagged parts", () => {
    expect(verifiedUploadedParts(parts, size, partSize)).toBe(true);
    expect([...uploadedPartNumbers(parts, size, partSize)]).toEqual([1, 2, 3]);
  });

  it("does not skip missing or incomplete parts during resume", () => {
    const remote = [
      parts[0],
      { ...parts[1], Size: partSize - 1 },
      { ...parts[2], ETag: "" },
    ];
    expect(verifiedUploadedParts(remote, size, partSize)).toBe(false);
    expect([...uploadedPartNumbers(remote, size, partSize)]).toEqual([1]);
  });

  it("rejects duplicate, reordered, and wrong-size parts before completion", () => {
    expect(verifiedUploadedParts([parts[0], parts[0], parts[2]], size, partSize)).toBe(false);
    expect(verifiedUploadedParts([parts[1], parts[0], parts[2]], size, partSize)).toBe(false);
    expect(verifiedUploadedParts([{ ...parts[0], Size: partSize + 1 }, parts[1], parts[2]], size, partSize)).toBe(false);
    expect(verifiedUploadedParts([parts[0], parts[1]], size, partSize)).toBe(false);
  });

  it("rejects malformed sizes and out-of-range part numbers", () => {
    expect(verifiedUploadedParts(parts, -1, partSize)).toBe(false);
    expect(verifiedUploadedParts(parts, size, 0)).toBe(false);
    expect([...uploadedPartNumbers([{ PartNumber: 0, Size: partSize, ETag: "bad" }, parts[2]], size, partSize)]).toEqual([3]);
  });
});
