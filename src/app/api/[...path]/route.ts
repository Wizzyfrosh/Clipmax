import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  user,
  origin,
  body,
  failure,
  ownedProject,
  HttpError,
} from "@/lib/http";
import { limits } from "@/lib/config";
import * as storage from "@/lib/storage";
import { enqueue } from "@/lib/jobs";
import { segmentsSchema } from "../../../../packages/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const id = z.string().uuid();
const json = (data: unknown, status = 200) => Response.json(data, { status });
async function handler(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    origin(req);
    const u = await user();
    const p = (await params).path;
    const method = req.method;
    const key = req.headers.get("idempotency-key") ?? "";
    if (p[0] === "usage" && method === "GET")
      return json(
        await db.quota.upsert({
          where: { ownerId: u.id },
          create: { ownerId: u.id },
          update: {},
        }),
      );
    if (p[0] === "admin" && method === "GET") {
      if (
        !(process.env.ADMIN_EMAILS ?? "")
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .includes(u.email.toLowerCase())
      )
        throw new HttpError(404, "NOT_FOUND");
      return json({
        jobs: await db.job.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            type: true,
            status: true,
            stage: true,
            attempt: true,
            errorCode: true,
            createdAt: true,
          },
        }),
        processingEnabled: process.env.PROCESSING_ENABLED === "true",
      });
    }
    if (p[0] === "projects") {
      if (p.length === 1 && method === "GET") {
        const cursor = new URL(req.url).searchParams.get("cursor");
        const projects = await db.project.findMany({
          where: { ownerId: u.id, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 25,
          ...(cursor ? { cursor: { id: id.parse(cursor) }, skip: 1 } : {}),
          select: {
            id: true,
            title: true,
            status: true,
            durationMs: true,
            createdAt: true,
            expiresAt: true,
            _count: { select: { clips: true } },
          },
        });
        return json({
          projects,
          nextCursor: projects.length === 25 ? projects.at(-1)?.id : null,
        });
      }
      if (p.length === 1 && method === "POST") {
        const data = z
          .object({
            title: z.string().trim().min(1).max(120),
            rightsConfirmed: z.literal(true),
            clipCount: z.number().int().min(1).max(5).default(3),
            layout: z.enum(["original", "vertical"]).default("original"),
          })
          .parse(await body(req));
        if (
          (await db.project.count({
            where: { ownerId: u.id, deletedAt: null },
          })) >= 20
        )
          throw new HttpError(429, "PROJECT_LIMIT");
        return json(
          await db.project.create({
            data: {
              ownerId: u.id,
              title: data.title,
              clipCount: data.clipCount,
              layout: data.layout,
              expiresAt: new Date(Date.now() + 7 * 86400000),
            },
          }),
          201,
        );
      }
      const project = await ownedProject(id.parse(p[1]), u.id);
      if (p.length === 2 && method === "GET") {
        const clips = await db.clip.findMany({
          where: { projectId: project.id },
          orderBy: { ordinal: "asc" },
          include: {
            revisions: {
              orderBy: { revision: "desc" },
              take: 1,
              include: { assets: { select: { id: true, kind: true } } },
            },
          },
        });
        const jobs = await db.job.findMany({
          where: { projectId: project.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            stage: true,
            errorCode: true,
            type: true,
          },
        });
        return json({
          ...project,
          sourceKey: undefined,
          transcript: undefined,
          selections: undefined,
          clips,
          jobs,
        });
      }
      if (p.length === 2 && method === "DELETE") {
        await db.$transaction(async (tx) => {
          await tx.project.update({
            where: { id: project.id },
            data: { deletedAt: new Date(), status: "deleting" },
          });
          await tx.job.updateMany({
            where: {
              projectId: project.id,
              status: { in: ["queued", "running", "retry_wait"] },
            },
            data: { cancelRequested: true },
          });
        });
        return json({ status: "deleting" }, 202);
      }
      if (p[2] === "process" && method === "POST")
        return json(await enqueue(u.id, project.id, "process", {}, key), 202);
      if (p[2] === "uploads" && method === "POST") {
        if (project.status !== "uploading")
          throw new HttpError(409, "SOURCE_ALREADY_SET");
        const data = z
          .object({
            size: z.number().int().min(1).max(limits.maxBytes),
            fingerprint: z.string().min(1).max(300),
          })
          .parse(await body(req));
        const active = await db.upload.findFirst({
          where: {
            projectId: project.id,
            state: "active",
            expiresAt: { gt: new Date() },
          },
        });
        if (active) {
          if (
            active.fingerprint !== data.fingerprint ||
            active.size !== data.size
          )
            throw new HttpError(409, "DIFFERENT_UPLOAD_ACTIVE");
          return json({ id: active.id, partSize: active.partSize });
        }
        const objectKey = `${u.id}/${project.id}/source-${crypto.randomUUID()}.mp4`;
        const uploadId = await storage.beginUpload(objectKey);
        const upload = await db.upload
          .create({
            data: {
              projectId: project.id,
              uploadId,
              objectKey,
              size: data.size,
              fingerprint: data.fingerprint,
              partSize: limits.partSize,
              expiresAt: new Date(Date.now() + 86400000),
            },
          })
          .catch(async (e) => {
            await storage.abortUpload(objectKey, uploadId).catch(() => {});
            throw e;
          });
        return json({ id: upload.id, partSize: upload.partSize }, 201);
      }
    }
    if (p[0] === "uploads") {
      const upload = await db.upload.findFirst({
        where: {
          id: id.parse(p[1]),
          project: {
            ownerId: u.id,
            deletedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      });
      if (!upload) throw new HttpError(404, "UPLOAD_NOT_FOUND");
      if (p[2] === "complete" && upload.state === "completed")
        return json({ status: "validating" }, 202);
      if (upload.expiresAt < new Date() || upload.state !== "active")
        throw new HttpError(409, "UPLOAD_EXPIRED");
      if (p[2] === "parts" && method === "GET")
        return json({
          parts: (
            await storage.listParts(upload.objectKey, upload.uploadId)
          ).map((x) => ({ partNumber: x.PartNumber, size: x.Size })),
        });
      if (p[2] === "parts" && p[3] === "sign" && method === "POST") {
        const { partNumber } = z
          .object({
            partNumber: z
              .number()
              .int()
              .min(1)
              .max(Math.ceil(upload.size / upload.partSize)),
          })
          .parse(await body(req));
        return json({
          url: await storage.signPart(
            upload.objectKey,
            upload.uploadId,
            partNumber,
          ),
        });
      }
      if (method === "DELETE") {
        await storage.abortUpload(upload.objectKey, upload.uploadId);
        await db.upload.update({
          where: { id: upload.id },
          data: { state: "aborted" },
        });
        return json({ status: "aborted" });
      }
      if (p[2] === "complete" && method === "POST") {
        let alreadyStored = false;
        try {
          alreadyStored =
            (await storage.objectSize(upload.objectKey)) === upload.size;
        } catch {}
        if (!alreadyStored) {
          const parts = (
            await storage.listParts(upload.objectKey, upload.uploadId)
          ).sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0));
          const count = Math.ceil(upload.size / upload.partSize);
          if (
            parts.length !== count ||
            parts.some(
              (part, i) =>
                part.PartNumber !== i + 1 ||
                part.Size !==
                  (i === count - 1
                    ? upload.size - i * upload.partSize
                    : upload.partSize) ||
                !part.ETag,
            )
          )
            throw new HttpError(422, "PARTS_INCOMPLETE");
          await storage.completeUpload(
            upload.objectKey,
            upload.uploadId,
            parts,
          );
        }
        if ((await storage.objectSize(upload.objectKey)) !== upload.size)
          throw new HttpError(422, "UPLOAD_SIZE_MISMATCH");
        await db.$transaction(async (tx) => {
          await tx.upload.update({
            where: { id: upload.id },
            data: { state: "completed" },
          });
          const updated = await tx.project.updateMany({
            where: { id: upload.projectId, ownerId: u.id, deletedAt: null },
            data: {
              sourceKey: upload.objectKey,
              sourceBytes: upload.size,
              status: "validating",
            },
          });
          if (!updated.count) throw new HttpError(404, "PROJECT_NOT_FOUND");
          await tx.job.upsert({
            where: { dedupeKey: `probe:${upload.id}` },
            create: {
              projectId: upload.projectId,
              type: "probe",
              payload: {},
              dedupeKey: `probe:${upload.id}`,
              requestHash: upload.id,
            },
            update: {},
          });
        });
        return json({ status: "validating" }, 202);
      }
    }
    if (p[0] === "jobs") {
      const job = await db.job.findFirst({
        where: {
          id: id.parse(p[1]),
          project: { ownerId: u.id, deletedAt: null },
        },
      });
      if (!job) throw new HttpError(404, "JOB_NOT_FOUND");
      if (method === "GET")
        return json({
          id: job.id,
          status: job.status,
          stage: job.stage,
          errorCode: job.errorCode,
        });
      if (p[2] === "cancel" && method === "POST") {
        await db.job.update({
          where: { id: job.id },
          data: { cancelRequested: true },
        });
        return json({ status: "cancel_requested" }, 202);
      }
    }
    if (p[0] === "clips") {
      const clip = await db.clip.findFirst({
        where: {
          id: id.parse(p[1]),
          project: {
            ownerId: u.id,
            deletedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
        include: {
          project: true,
          revisions: { orderBy: { revision: "desc" }, take: 1 },
        },
      });
      if (!clip) throw new HttpError(404, "CLIP_NOT_FOUND");
      const current = clip.revisions[0];
      if (method === "PATCH" && p.length === 2) {
        const data = z
          .object({
            expectedRevision: z.number().int(),
            title: z.string().min(1).max(120),
            startMs: z.number().int().nonnegative(),
            endMs: z.number().int().positive(),
            layout: z.enum(["original", "vertical"]),
            script: z.string().max(4000),
            voicePrompt: z.string().max(5000),
            captions: segmentsSchema,
          })
          .parse(await body(req));
        if (
          data.endMs - data.startMs < 20000 ||
          data.endMs - data.startMs > 60000 ||
          data.endMs > (clip.project.durationMs ?? 0)
        )
          throw new HttpError(422, "INVALID_RANGE");
        if (
          data.captions.some(
            (c) => c.endMs <= c.startMs || c.endMs > data.endMs - data.startMs,
          )
        )
          throw new HttpError(422, "INVALID_CAPTIONS");
        const revision = await db.$transaction(async (tx) => {
          const changed = await tx.clip.updateMany({
            where: { id: clip.id, currentRevision: data.expectedRevision },
            data: { currentRevision: { increment: 1 } },
          });
          if (!changed.count) throw new HttpError(409, "REVISION_CONFLICT");
          return tx.revision.create({
            data: {
              clipId: clip.id,
              revision: data.expectedRevision + 1,
              title: data.title,
              reason: current.reason,
              startMs: data.startMs,
              endMs: data.endMs,
              layout: data.layout,
              captions: data.captions,
              script: data.script,
              voicePrompt: data.voicePrompt,
              scriptStale:
                data.startMs !== current.startMs ||
                data.endMs !== current.endMs,
            },
          });
        });
        return json(revision);
      }
      if (["render", "script"].includes(p[2]) && method === "POST")
        return json(
          await enqueue(
            u.id,
            clip.projectId,
            p[2],
            { revisionId: current.id },
            key,
          ),
          202,
        );
      if (p[2] === "feedback" && method === "POST") {
        const d = z
          .object({
            useful: z.boolean(),
            comment: z.string().max(1000).default(""),
          })
          .parse(await body(req));
        return json(
          await db.feedback.upsert({
            where: { clipId_ownerId: { clipId: clip.id, ownerId: u.id } },
            create: { clipId: clip.id, ownerId: u.id, ...d },
            update: d,
          }),
        );
      }
    }
    if (p[0] === "assets" && p[2] === "download" && method === "POST") {
      const asset = await db.asset.findFirst({
        where: {
          id: id.parse(p[1]),
          project: {
            ownerId: u.id,
            deletedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      });
      if (!asset) throw new HttpError(404, "ASSET_NOT_FOUND");
      return json({
        url: await storage.downloadUrl(
          asset.objectKey,
          new URL(req.url).searchParams.get("attachment") === "1",
        ),
      });
    }
    throw new HttpError(404, "NOT_FOUND");
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return failure(new HttpError(409, "CONFLICT"));
    return failure(e);
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
