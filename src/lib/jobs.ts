import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./http";
export function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export async function enqueue(
  ownerId: string,
  projectId: string,
  type: string,
  payload: Prisma.InputJsonValue,
  key: string,
) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key))
    throw new HttpError(422, "IDEMPOTENCY_KEY_REQUIRED");
  const dedupeKey = `${ownerId}:${type}:${key}`,
    requestHash = hash({ projectId, payload });
  return db.$transaction(
    async (tx) => {
      // Per-user serialization prevents racing quota reservations and active pipelines.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${ownerId} FOR UPDATE`;
      const existing = await tx.job.findUnique({ where: { dedupeKey } });
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new HttpError(409, "IDEMPOTENCY_CONFLICT");
        return existing;
      }
      const p = await tx.project.findFirst({
        where: {
          id: projectId,
          ownerId,
          deletedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!p) throw new HttpError(404, "PROJECT_NOT_FOUND");
      if (
        ["process", "render", "script"].includes(type) &&
        process.env.PROCESSING_ENABLED !== "true"
      )
        throw new HttpError(503, "PROCESSING_PAUSED");
      let minutes = 0;
      if (type === "process") {
        if (
          !["ready", "failed", "cancelled", "partially_completed"].includes(
            p.status,
          ) ||
          !p.durationMs
        )
          throw new HttpError(409, "SOURCE_NOT_READY");
        if (
          await tx.job.count({
            where: {
              project: { ownerId },
              type: "process",
              status: { in: ["queued", "running", "retry_wait"] },
            },
          })
        )
          throw new HttpError(409, "PIPELINE_ALREADY_ACTIVE");
        minutes = Math.ceil(p.durationMs / 60000);
        const q = await tx.quota.upsert({
          where: { ownerId },
          create: { ownerId },
          update: {},
        });
        if (q.allowance - q.reserved - q.consumed < minutes)
          throw new HttpError(429, "QUOTA_EXHAUSTED");
        await tx.quota.update({
          where: { ownerId },
          data: { reserved: { increment: minutes } },
        });
      }
      const fields = payload as Record<string, Prisma.InputJsonValue>;
      if (type === "render" || type === "script") {
        const r = await tx.revision.findFirst({
          where: { id: String(fields.revisionId), clip: { projectId } },
        });
        if (!r) throw new HttpError(404, "REVISION_NOT_FOUND");
        const totals = await tx.revision.aggregate({
          where: { clipId: r.clipId },
          _sum: { renderCount: true, scriptCount: true },
        });
        const count =
          (type === "render"
            ? totals._sum.renderCount
            : totals._sum.scriptCount) ?? 0;
        if (count >= 2) throw new HttpError(429, "REGENERATION_LIMIT");
        await tx.revision.update({
          where: { id: r.id },
          data:
            type === "render"
              ? { renderCount: { increment: 1 }, status: "pending" }
              : { scriptCount: { increment: 1 } },
        });
      }
      // Serializes monthly reservations across users. Held only during this short transaction.
      if (type === "process" || type === "script") {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(7241501)::text`;
        const month = new Date();
        month.setUTCDate(1);
        month.setUTCHours(0, 0, 0, 0);
        const used = await tx.usageEvent.aggregate({
          where: { kind: "budget_reservation", createdAt: { gte: month } },
          _sum: { units: true },
        });
        const bound = Number(process.env.AI_JOB_BUDGET_MICROS),
          budget = Number(process.env.MONTHLY_AI_BUDGET_MICROS);
        if (
          !Number.isSafeInteger(bound) ||
          bound <= 0 ||
          !Number.isSafeInteger(budget) ||
          budget <= 0
        )
          throw new HttpError(503, "BUDGET_NOT_CONFIGURED");
        if ((used._sum.units ?? 0) + bound > budget)
          throw new HttpError(429, "MONTHLY_BUDGET_REACHED");
        await tx.usageEvent.create({
          data: {
            ownerId,
            jobId: dedupeKey,
            kind: "budget_reservation",
            units: bound,
            detail: {
              note: "Conservative reservation retained even on failure",
            },
            dedupeKey: `budget:${dedupeKey}`,
          },
        });
      }
      const job = await tx.job.create({
        data: {
          projectId,
          type,
          payload,
          dedupeKey,
          requestHash,
          reservedMinutes: minutes,
        },
      });
      if (type === "process")
        await tx.project.update({
          where: { id: projectId },
          data: { status: "queued", errorCode: null },
        });
      return job;
    },
    { timeout: 10000 },
  );
}
