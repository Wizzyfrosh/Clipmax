import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFile } from "node:fs/promises";

// Real embedded PostgreSQL, not mocked query responses. This does not replace
// multi-connection concurrency/fault testing against staging Neon.
const pg = new PGlite();
let server: PGLiteSocketServer;
let db: typeof import("../src/lib/db").db;
let enqueue: typeof import("../src/lib/jobs").enqueue;
let ownedProject: typeof import("../src/lib/http").ownedProject;
let projectId: string;
beforeAll(async () => {
  for (const name of ["202610150001_initial", "202610150002_invariants"]) {
    await pg.exec(
      await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"),
    );
  }
  server = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port: 15433 });
  await server.start();
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@127.0.0.1:15433/postgres?connection_limit=1";
  process.env.PROCESSING_ENABLED = "true";
  process.env.AI_JOB_BUDGET_MICROS = "1000000";
  process.env.MONTHLY_AI_BUDGET_MICROS = "15000000";
  process.env.BETTER_AUTH_SECRET =
    "test-only-auth-secret-at-least-thirty-two-characters";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  ({ db } = await import("../src/lib/db"));
  ({ enqueue } = await import("../src/lib/jobs"));
  ({ ownedProject } = await import("../src/lib/http"));
  await db.user.createMany({
    data: [
      { id: "owner-a", name: "A", email: "a@example.test" },
      { id: "owner-b", name: "B", email: "b@example.test" },
    ],
  });
  const project = await db.project.create({
    data: {
      ownerId: "owner-a",
      title: "Private source",
      durationMs: 120001,
      status: "ready",
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  projectId = project.id;
}, 30000);
afterAll(async () => {
  await db?.$disconnect();
  await server?.stop();
  await pg.close();
});
describe("database authorization and accounting", () => {
  it("rejects uninvited signup before creating an account", async () => {
    process.env.PILOT_INVITE_EMAILS = "invited@example.test";
    const { getAuth } = await import("../src/lib/auth");
    const response = await getAuth().handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "Uninvited",
          email: "outside@example.test",
          password: "testpassword123",
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("INVITATION_REQUIRED");
    expect(
      await db.user.count({ where: { email: "outside@example.test" } }),
    ).toBe(0);
  });
  it("does not create an invited account when verification email is unavailable", async () => {
    process.env.PILOT_INVITE_EMAILS = " INVITED@example.test ";
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    const { getAuth } = await import("../src/lib/auth");
    const response = await getAuth().handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "Invited",
          email: "invited@example.test",
          password: "testpassword123",
        }),
      }),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("EMAIL_NOT_CONFIGURED");
    expect(
      await db.user.count({ where: { email: "invited@example.test" } }),
    ).toBe(0);
  });
  it("allows owner, denies other account", async () => {
    expect((await ownedProject(projectId, "owner-a")).title).toBe(
      "Private source",
    );
    await expect(ownedProject(projectId, "owner-b")).rejects.toThrow(
      "PROJECT_NOT_FOUND",
    );
    await expect(
      enqueue("owner-b", projectId, "process", {}, "foreign-key-123"),
    ).rejects.toThrow("PROJECT_NOT_FOUND");
  });
  it("reserves rounded minutes only once for duplicate requests", async () => {
    const first = await enqueue(
      "owner-a",
      projectId,
      "process",
      {},
      "process-key-123",
    );
    const second = await enqueue(
      "owner-a",
      projectId,
      "process",
      {},
      "process-key-123",
    );
    expect(first.id).toBe(second.id);
    expect(
      (await db.quota.findUniqueOrThrow({ where: { ownerId: "owner-a" } }))
        .reserved,
    ).toBe(3);
    await expect(
      enqueue(
        "owner-a",
        projectId,
        "process",
        { changed: true },
        "process-key-123",
      ),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("rejects negative quotas in the database", async () => {
    await expect(
      pg.query('UPDATE "Quota" SET reserved=-1 WHERE "ownerId"=$1', [
        "owner-a",
      ]),
    ).rejects.toThrow();
  });
  it("does not reset regeneration limits on a new revision", async () => {
    const clip = await db.clip.create({
      data: { projectId, ordinal: 0, currentRevision: 2 },
    });
    const base = {
      clipId: clip.id,
      title: "Clip",
      reason: "Evidence",
      startMs: 0,
      endMs: 21000,
      layout: "original",
      captions: [],
      script: "Commentary",
      voicePrompt: "Read commentary",
    };
    await db.revision.create({
      data: { ...base, revision: 1, renderCount: 2 },
    });
    const revision = await db.revision.create({
      data: { ...base, revision: 2 },
    });
    await expect(
      enqueue(
        "owner-a",
        projectId,
        "render",
        { revisionId: revision.id },
        "render-limit-123",
      ),
    ).rejects.toThrow("REGENERATION_LIMIT");
  });
  it("denies tombstoned project access", async () => {
    await db.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
    await expect(ownedProject(projectId, "owner-a")).rejects.toThrow(
      "PROJECT_NOT_FOUND",
    );
  });
});
