/**
 * Verify Cloudflare R2 S3 ListParts response before treating parts as complete.
 * Multipart parts must have continuous indices, exact sizes and valid ETags.
 * A part lacking an ETag cannot be passed to CompleteMultipartUpload.
 */
export type UploadedPart = {
  PartNumber?: number;
  Size?: number;
  ETag?: string;
};

export function verifiedUploadedParts(
  parts: readonly UploadedPart[],
  totalBytes: number,
  partSize: number,
): boolean {
  if (
    !Number.isSafeInteger(totalBytes) ||
    totalBytes <= 0 ||
    !Number.isSafeInteger(partSize) ||
    partSize < 5 * 1024 * 1024
  ) return false;
  const expectedCount = Math.ceil(totalBytes / partSize);
  if (!expectedCount || parts.length !== expectedCount) return false;
  return parts.every((part, i) => {
    const expectedSize = i === expectedCount - 1
      ? totalBytes - i * partSize
      : partSize;
    return (
      part.PartNumber === i + 1 &&
      part.Size === expectedSize &&
      typeof part.ETag === "string" &&
      part.ETag.trim().length > 0
    );
  });
}

/**
 * Browser progress is based on confirmed remote bytes, never only part numbers.
 * Invalid/partial upload parts are retried, not incorrectly skipped.
 */
export function uploadedPartNumbers(
  parts: readonly UploadedPart[],
  totalBytes: number,
  partSize: number,
): Set<number> {
  const done = new Set<number>();
  if (!Number.isSafeInteger(totalBytes) || totalBytes < 1 ||
      !Number.isSafeInteger(partSize) || partSize < 1) return done;
  const count = Math.ceil(totalBytes / partSize);
  for (const part of parts) {
    const n = part.PartNumber;
    if (!Number.isInteger(n) || n === undefined || n < 1 || n > count) continue;
    const expectedSize = n === count ? totalBytes - (n - 1) * partSize : partSize;
    if (part.Size === expectedSize && part.ETag?.trim()) done.add(n);
  }
  return done;
}
