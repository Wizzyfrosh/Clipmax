import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { required } from "./config";
function client() {
  return new S3Client({
    region: "auto",
    endpoint: required("R2_ENDPOINT"),
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
    maxAttempts: 3,
  });
}
function base(Key: string) {
  return { Bucket: required("R2_BUCKET"), Key };
}
export async function beginUpload(key: string) {
  const r = await client().send(
    new CreateMultipartUploadCommand({
      ...base(key),
      ContentType: "video/mp4",
    }),
  );
  if (!r.UploadId) throw Error("UPLOAD_FAILED");
  return r.UploadId;
}
export async function signPart(key: string, uploadId: string, part: number) {
  return getSignedUrl(
    client(),
    new UploadPartCommand({
      ...base(key),
      UploadId: uploadId,
      PartNumber: part,
    }),
    { expiresIn: 900 },
  );
}
export async function listParts(key: string, uploadId: string) {
  const r = await client().send(
    new ListPartsCommand({ ...base(key), UploadId: uploadId, MaxParts: 1000 }),
  );
  return r.Parts ?? [];
}
export async function completeUpload(
  key: string,
  uploadId: string,
  parts: { ETag?: string; PartNumber?: number }[],
) {
  await client().send(
    new CompleteMultipartUploadCommand({
      ...base(key),
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }),
  );
}
export async function abortUpload(key: string, uploadId: string) {
  await client().send(
    new AbortMultipartUploadCommand({ ...base(key), UploadId: uploadId }),
  );
}
export async function objectSize(key: string) {
  return (await client().send(new HeadObjectCommand(base(key)))).ContentLength;
}
export async function downloadUrl(key: string, attachment = false) {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      ...base(key),
      ...(attachment ? { ResponseContentDisposition: "attachment" } : {}),
    }),
    { expiresIn: 300 },
  );
}
export async function fetchObject(
  key: string,
  path: string,
  signal?: AbortSignal,
) {
  const r = await client().send(new GetObjectCommand(base(key)), {
    abortSignal: signal,
  });
  if (!r.Body) throw Error("SOURCE_MISSING");
  let bytes = 0;
  const limit = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      callback(bytes > 500_000_000 ? Error("VIDEO_TOO_LARGE") : null, chunk);
    },
  });
  await pipeline(r.Body as Readable, limit, createWriteStream(path), {
    signal,
  });
}
export async function uploadFile(key: string, path: string, type: string) {
  await client().send(
    new PutObjectCommand({
      ...base(key),
      Body: createReadStream(path),
      ContentLength: (await stat(path)).size,
      ContentType: type,
    }),
  );
}
export async function removeObject(key: string) {
  await client().send(new DeleteObjectCommand(base(key)));
}
