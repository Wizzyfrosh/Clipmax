import "dotenv/config";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Prisma, type Job, type Revision } from "@prisma/client";
import { db } from "../../src/lib/db";
import {
  fetchObject,
  uploadFile,
  removeObject,
  abortUpload,
} from "../../src/lib/storage";
import { probe, extract, render } from "../../packages/media";
import { transcribe, select } from "../../packages/ai";
import {
  segmentsSchema,
  selectRanges,
  captionsFor,
  srt,
} from "../../packages/contracts";
const terminal = ["done", "failed", "cancelled"];
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function code(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /^(UNSUPPORTED_|INVALID_|INSUFFICIENT_|VIDEO_TOO_LARGE|AI_EMPTY|OUTPUT_)/.test(
    message,
  )
    ? message.split(":")[0]
    : "PROCESSING_FAILED";
}
async function claim() {
  return db.$transaction(async (tx) => {
    // Global transaction lock prevents two workers observing the same empty running set.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(7241502)::text`;
    await tx.job.updateMany({
      where: { status: "running", leaseUntil: { lt: new Date() } },
      data: { status: "retry_wait", leaseToken: null, leaseUntil: null },
    });
    if (await tx.job.count({ where: { status: "running" } })) return null;
    const jobs = await tx.$queryRaw<
      Job[]
    >`SELECT * FROM "Job" WHERE status IN ('queued','retry_wait') AND "availableAt" <= NOW() ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
    const j = jobs[0];
    if (!j) return null;
    return tx.job.update({
      where: { id: j.id },
      data: {
        status: "running",
        attempt: { increment: 1 },
        leaseToken: crypto.randomUUID(),
        leaseUntil: new Date(Date.now() + 90000),
      },
    });
  });
}
async function fenced(
  job: Job,
  fn: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  await db.$transaction(async (tx) => {
    const current = await tx.$queryRaw<
      Job[]
    >`SELECT * FROM "Job" WHERE id=${job.id} AND "leaseToken"=${job.leaseToken} AND status='running' AND "leaseUntil">NOW() FOR UPDATE`;
    if (!current[0] || current[0].cancelRequested) throw Error("LEASE_LOST");
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${job.projectId} FOR UPDATE`;
    const p = await tx.project.findUnique({ where: { id: job.projectId } });
    if (!p || p.deletedAt || p.expiresAt < new Date())
      throw Error("PROJECT_DELETED");
    await fn(tx);
  });
}
async function stage(job: Job, name: string) {
  await fenced(job, async (tx) => {
    await tx.job.update({ where: { id: job.id }, data: { stage: name } });
    if (job.type === "process")
      await tx.project.update({
        where: { id: job.projectId },
        data: { status: name },
      });
  });
}
async function renderRevision(
  job: Job,
  r: Revision,
  source: string,
  dir: string,
  signal: AbortSignal,
) {
  const existing = await db.asset.findMany({ where: { revisionId: r.id } });
  if (r.status === "completed" && existing.some((a) => a.kind === "video"))
    return;
  const base = `${job.projectId}/${r.id}/${job.leaseToken}`;
  const video = join(dir, `${r.id}.mp4`),
    captions = join(dir, `${r.id}.srt`),
    text = join(dir, `${r.id}.txt`);
  await render(source, video, r.startMs, r.endMs, r.layout, signal);
  await writeFile(captions, srt(segmentsSchema.parse(r.captions)));
  await writeFile(
    text,
    `${r.title}\n\nCOMMENTARY\n${r.script}\n\nVOICE GENERATION PROMPT\n${r.voicePrompt}`,
  );
  const files = [
    ["video", video, "video/mp4"],
    ["captions", captions, "application/x-subrip"],
    ["script", text, "text/plain"],
  ] as const;
  const keys: string[] = [];
  try {
    for (const [kind, path, type] of files) {
      const key = `${base}/${kind}.${kind === "video" ? "mp4" : kind === "captions" ? "srt" : "txt"}`;
      keys.push(key);
      await uploadFile(key, path, type);
    }
    await fenced(job, async (tx) => {
      const clip = await tx.clip.findUnique({ where: { id: r.clipId } });
      if (clip?.currentRevision !== r.revision) throw Error("STALE_REVISION");
      await tx.asset.deleteMany({ where: { revisionId: r.id } });
      for (let i = 0; i < files.length; i++)
        await tx.asset.create({
          data: {
            projectId: job.projectId,
            revisionId: r.id,
            kind: files[i][0],
            objectKey: keys[i],
          },
        });
      await tx.revision.update({
        where: { id: r.id },
        data: { status: "completed" },
      });
    });
    await Promise.allSettled(existing.map((a) => removeObject(a.objectKey)));
  } catch (e) {
    await Promise.allSettled(keys.map(removeObject));
    throw e;
  }
}
async function settle(job: Job, status: string, errorCode?: string) {
  await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Job[]
    >`SELECT * FROM "Job" WHERE id=${job.id} AND "leaseToken"=${job.leaseToken} AND status='running' FOR UPDATE`;
    const j = rows[0];
    if (!j) return;
    const project = await tx.project.findUniqueOrThrow({
      where: { id: j.projectId },
    });
    const outputs = await tx.asset.count({
      where: { projectId: j.projectId, kind: "video" },
    });
    if (!j.settled && j.reservedMinutes) {
      await tx.quota.update({
        where: { ownerId: project.ownerId },
        data: {
          reserved: { decrement: j.reservedMinutes },
          consumed: { increment: outputs ? j.reservedMinutes : 0 },
        },
      });
      await tx.usageEvent.upsert({
        where: { dedupeKey: `settle:${j.id}` },
        create: {
          ownerId: project.ownerId,
          jobId: j.id,
          kind: "input_minutes",
          units: outputs ? j.reservedMinutes : 0,
          detail: { status },
          dedupeKey: `settle:${j.id}`,
        },
        update: {},
      });
    }
    await tx.job.update({
      where: { id: j.id },
      data: {
        status,
        stage: status,
        settled: true,
        errorCode,
        leaseToken: null,
        leaseUntil: null,
      },
    });
    if (!project.deletedAt && ["process", "probe"].includes(j.type))
      await tx.project.update({
        where: { id: project.id },
        data: {
          status:
            status === "done"
              ? j.type === "probe"
                ? "ready"
                : "completed"
              : outputs
                ? "partially_completed"
                : status,
          errorCode,
        },
      });
  });
}
async function run(job: Job) {
  const dir = await mkdtemp(join(tmpdir(), "clipmax-")),
    controller = new AbortController();
  let renewing = false;
  const heartbeat = setInterval(async () => {
    if (renewing) return;
    renewing = true;
    try {
      const updated = await db.job.updateMany({
        where: {
          id: job.id,
          leaseToken: job.leaseToken,
          status: "running",
          cancelRequested: false,
          project: { deletedAt: null, expiresAt: { gt: new Date() } },
        },
        data: { leaseUntil: new Date(Date.now() + 90000) },
      });
      if (!updated.count) controller.abort();
    } catch {
      controller.abort();
    } finally {
      renewing = false;
    }
  }, 15000);
  try {
    const p = await db.project.findUniqueOrThrow({
      where: { id: job.projectId },
    });
    if (job.cancelRequested || p.deletedAt || p.expiresAt < new Date()) {
      await settle(job, "cancelled");
      return;
    }
    if (job.attempt > 3) {
      await settle(job, "failed", "RETRY_LIMIT");
      return;
    }
    if (!p.sourceKey) throw Error("SOURCE_MISSING");
    const source = join(dir, "source.mp4");
    await fetchObject(p.sourceKey, source, controller.signal);
    await stage(job, "validating");
    const meta = await probe(source, controller.signal);
    if (job.type === "probe") {
      await fenced(job, async (tx) => {
        await tx.project.update({
          where: { id: p.id },
          data: { durationMs: meta.durationMs },
        });
      });
      await settle(job, "done");
      return;
    }
    if (job.type === "render") {
      const payload = job.payload as { revisionId: string };
      const r = await db.revision.findUniqueOrThrow({
        where: { id: payload.revisionId },
      });
      await stage(job, "rendering");
      await renderRevision(job, r, source, dir, controller.signal);
      await settle(job, "done");
      return;
    }
    if (process.env.PROCESSING_ENABLED !== "true")
      throw Error("PROCESSING_PAUSED");
    let transcript = p.transcript;
    if (!transcript) {
      await stage(job, "transcribing");
      const audio = join(dir, "audio.mp3");
      await extract(source, audio, controller.signal);
      const result = await transcribe(audio, controller.signal);
      transcript = result.segments;
      await fenced(job, async (tx) => {
        await tx.project.update({
          where: { id: p.id },
          data: { transcript: result.segments },
        });
        await tx.usageEvent.create({
          data: {
            ownerId: p.ownerId,
            jobId: job.id,
            kind: "transcription_seconds",
            units: Math.ceil(result.duration),
            detail: { requestId: result.requestId, model: "whisper-1" },
            dedupeKey: `speech:${job.id}:${job.attempt}`,
          },
        });
      });
    }
    const segments = segmentsSchema.parse(transcript);
    if (job.type === "script") {
      const r = await db.revision.findUniqueOrThrow({
        where: { id: (job.payload as { revisionId: string }).revisionId },
      });
      const result = await select(
        segments.filter((s) => s.endMs > r.startMs && s.startMs < r.endMs),
        1,
        controller.signal,
      );
      const c = result.candidates[0];
      if (!c) throw Error("INSUFFICIENT_SPEECH");
      await fenced(job, async (tx) => {
        const clip = await tx.clip.findUniqueOrThrow({
          where: { id: r.clipId },
        });
        if (clip.currentRevision !== r.revision) throw Error("STALE_REVISION");
        const changed = await tx.clip.updateMany({
          where: { id: r.clipId, currentRevision: r.revision },
          data: { currentRevision: { increment: 1 } },
        });
        if (!changed.count) throw Error("STALE_REVISION");
        await tx.revision.create({
          data: {
            clipId: r.clipId,
            revision: r.revision + 1,
            title: r.title,
            reason: r.reason,
            startMs: r.startMs,
            endMs: r.endMs,
            layout: r.layout,
            captions: r.captions as Prisma.InputJsonValue,
            script: c.script,
            voicePrompt: c.voicePrompt,
            scriptStale: false,
            status: "pending",
          },
        });
        await tx.usageEvent.create({
          data: {
            ownerId: p.ownerId,
            jobId: job.id,
            kind: "text_tokens",
            units: result.usage?.total_tokens ?? 0,
            detail: {
              usage: result.usage,
              requestId: result.requestId,
            } as Prisma.InputJsonValue,
            dedupeKey: `script:${job.id}:${job.attempt}`,
          },
        });
      });
      await settle(job, "done");
      return;
    }
    if (!p.selections) {
      await stage(job, "selecting");
      const result = await select(segments, p.clipCount, controller.signal);
      const selections = selectRanges(
        result.candidates,
        segments,
        meta.durationMs,
      ).slice(0, p.clipCount);
      if (!selections.length) throw Error("INSUFFICIENT_CANDIDATES");
      await fenced(job, async (tx) => {
        await tx.project.update({ where: { id: p.id }, data: { selections } });
        for (const [ordinal, c] of selections.entries()) {
          const clip = await tx.clip.upsert({
            where: { projectId_ordinal: { projectId: p.id, ordinal } },
            create: { projectId: p.id, ordinal },
            update: {},
          });
          await tx.revision.upsert({
            where: { clipId_revision: { clipId: clip.id, revision: 1 } },
            create: {
              clipId: clip.id,
              revision: 1,
              title: c.title,
              reason: c.reason,
              startMs: c.startMs,
              endMs: c.endMs,
              layout: p.layout,
              captions: captionsFor(segments, c.startMs, c.endMs),
              script: c.script,
              voicePrompt: c.voicePrompt,
            },
            update: {},
          });
        }
        await tx.usageEvent.create({
          data: {
            ownerId: p.ownerId,
            jobId: job.id,
            kind: "text_tokens",
            units: result.usage?.total_tokens ?? 0,
            detail: {
              usage: result.usage,
              requestId: result.requestId,
            } as Prisma.InputJsonValue,
            dedupeKey: `text:${job.id}:${job.attempt}`,
          },
        });
      });
    }
    await stage(job, "rendering");
    const clips = await db.clip.findMany({
      where: { projectId: p.id },
      include: { revisions: { orderBy: { revision: "desc" }, take: 1 } },
    });
    for (const clip of clips)
      await renderRevision(
        job,
        clip.revisions[0],
        source,
        dir,
        controller.signal,
      );
    await settle(job, "done");
  } catch (e) {
    const latest = await db.job.findUnique({
      where: { id: job.id },
      include: { project: true },
    });
    if (
      latest?.cancelRequested ||
      latest?.project.deletedAt ||
      controller.signal.aborted
    )
      await settle(job, "cancelled");
    else if (job.attempt < 3 && code(e) === "PROCESSING_FAILED")
      await db.job.updateMany({
        where: { id: job.id, leaseToken: job.leaseToken },
        data: {
          status: "retry_wait",
          errorCode: code(e),
          availableAt: new Date(Date.now() + 30000 * job.attempt),
          leaseUntil: null,
          leaseToken: null,
        },
      });
    else await settle(job, "failed", code(e));
    console.error(JSON.stringify({ jobId: job.id, code: code(e) }));
  } finally {
    clearInterval(heartbeat);
    await rm(dir, { recursive: true, force: true });
  }
}
async function cleanup() {
  await db.project.updateMany({
    where: { expiresAt: { lt: new Date() }, deletedAt: null },
    data: { deletedAt: new Date(), status: "deleting" },
  });
  const projects = await db.project.findMany({
    where: { deletedAt: { not: null }, status: { not: "deleted" } },
    take: 10,
    include: { assets: true, uploads: true },
  });
  for (const p of projects) {
    await db.job.updateMany({
      where: {
        projectId: p.id,
        status: { in: ["queued", "running", "retry_wait"] },
      },
      data: { cancelRequested: true },
    });
    if (
      await db.job.count({
        where: {
          projectId: p.id,
          status: { in: ["queued", "running", "retry_wait"] },
        },
      })
    )
      continue;
    for (const u of p.uploads) {
      if (u.state === "active")
        await abortUpload(u.objectKey, u.uploadId).catch(() => {});
      await removeObject(u.objectKey);
    }
    for (const a of p.assets) await removeObject(a.objectKey);
    if (p.sourceKey) await removeObject(p.sourceKey);
    await db.$transaction(async (tx) => {
      await tx.asset.deleteMany({ where: { projectId: p.id } });
      await tx.feedback.deleteMany({ where: { clip: { projectId: p.id } } });
      await tx.revision.deleteMany({ where: { clip: { projectId: p.id } } });
      await tx.clip.deleteMany({ where: { projectId: p.id } });
      await tx.upload.deleteMany({ where: { projectId: p.id } });
      await tx.project.update({
        where: { id: p.id },
        data: {
          title: "Deleted project",
          status: "deleted",
          sourceKey: null,
          transcript: Prisma.DbNull,
          selections: Prisma.DbNull,
        },
      });
    });
  }
  const uploads = await db.upload.findMany({
    where: { state: "active", expiresAt: { lt: new Date() } },
    take: 20,
  });
  for (const u of uploads) {
    await abortUpload(u.objectKey, u.uploadId);
    await db.upload.update({ where: { id: u.id }, data: { state: "expired" } });
  }
}
async function main() {
  let idle = 1000,
    lastCleanup = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastCleanup > 60000) {
        await cleanup();
        lastCleanup = Date.now();
      }
      const job = await claim();
      if (job) {
        idle = 1000;
        await run(job);
      } else {
        await sleep(idle);
        idle = Math.min(30000, idle * 2);
      }
    } catch {
      console.error("WORKER_CYCLE_FAILED");
      await sleep(10000);
    }
  }
  await db.$disconnect();
}
main().catch(() => {
  console.error("WORKER_FATAL");
  process.exitCode = 1;
});
