import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFile } from "node:fs/promises";

const { sent } = vi.hoisted(() => ({
  sent: [] as { text: string; subject: string }[],
}));
// Only external email delivery is mocked; auth handlers and PostgreSQL are real.
vi.mock("../src/lib/email", () => ({
  sendAuthEmail: async (_to: string, subject: string, url: string) => {
    sent.push({ subject, text: `${subject}\n\n${url}` });
  },
  sendVerificationCodeEmail: async (_to: string, otp: string) => {
    sent.push({ subject: "Your Clipmax verification code", text: otp });
  },
}));

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
  it("does not create an account when verification email is unavailable", async () => {
    delete process.env.PILOT_INVITE_EMAILS;
    delete process.env.BREVO_API_KEY;
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
  it("verifies email, accepts eight characters, resets once and revokes sessions", async () => {
    delete process.env.PILOT_INVITE_EMAILS;
    process.env.BREVO_API_KEY = "test-only";
    process.env.EMAIL_FROM = "test@example.test";
    const { createAuth } = await import("../src/lib/auth");
    const auth = createAuth();
    expect(auth.options.emailVerification?.sendOnSignUp).toBe(true);
    const post = async (path: string, body: unknown) => {
      // Each case starts a fresh rate-limit window; production limits stay enabled.
      await db.rateLimit.deleteMany();
      return auth.handler(
        new Request(`http://localhost:3000/api/auth/${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify(body),
        }),
      );
    };
    const credentials = {
      email: "flow@example.test",
      password: "Eight123",
      name: "Flow",
    };
    expect(
      (await post("sign-up/email", { ...credentials, password: "Short12" }))
        .status,
    ).toBe(400);
    expect((await post("sign-up/email", credentials)).status).toBe(200);
    expect((await post("sign-in/email", credentials)).status).toBe(403);
    const code = sent.find((m) => m.subject.includes("verification code"))?.text;
    expect(code).toMatch(/^\d{6}$/);
    expect(
      (await post("email-otp/verify-email", {
        email: credentials.email,
        otp: "000000",
      })).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await post("email-otp/verify-email", {
        email: credentials.email,
        otp: code,
      })).status,
    ).toBe(200);
    expect(
      (await post("email-otp/verify-email", {
        email: credentials.email,
        otp: code,
      })).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await post("sign-in/email", { ...credentials, password: "wrong123" }))
        .status,
    ).toBe(401);
    expect((await post("sign-in/email", credentials)).status).toBe(200);
    const user = await db.user.findUniqueOrThrow({
      where: { email: credentials.email },
    });
    expect(
      await db.session.count({ where: { userId: user.id } }),
    ).toBeGreaterThan(0);
    const reset = await post("request-password-reset", {
      email: credentials.email,
      redirectTo: "/reset-password",
    });
    expect(reset.status).toBe(200);
    const unknown = await post("request-password-reset", {
      email: "missing@example.test",
      redirectTo: "/reset-password",
    });
    expect(await unknown.json()).toEqual(await reset.json());
    const resetURL = sent
      .find((m) => m.subject.includes("Reset"))!
      .text.split("\n")[2];
    const token = new URL(resetURL).pathname.split("/").pop();
    expect(
      (await post("reset-password", { token, newPassword: "Short12" })).status,
    ).toBe(400);
    expect(
      (await post("reset-password", { token, newPassword: "Newpass8" })).status,
    ).toBe(200);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(
      (await post("reset-password", { token, newPassword: "Other123" })).status,
    ).toBe(400);
    expect((await post("sign-in/email", credentials)).status).toBe(401);
    expect(
      (await post("sign-in/email", { ...credentials, password: "Newpass8" }))
        .status,
    ).toBe(200);
  });
  it("allows public verified Google provisioning and starts the OAuth redirect", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    delete process.env.PILOT_INVITE_EMAILS;
    const { createAuth } = await import("../src/lib/auth");
    const auth = createAuth();
    const validate = auth.options.user!.validateUserInfo!;
    // The provider identity is supplied by Better Auth, never by a client form.
    const source = {
      method: "oauth",
      action: "create-user" as const,
      oauth: { providerId: "google" },
    };
    expect(
      await validate({
        user: { email: "outside@example.test", emailVerified: true },
        source,
      }),
    ).toBeUndefined();
    expect(
      await validate({
        user: { email: "google@example.test", emailVerified: false },
        source,
      }),
    ).toEqual({ error: "email_not_verified" });
    expect(
      await validate({
        user: { email: "google@example.test", emailVerified: true },
        source,
      }),
    ).toBeUndefined();
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ provider: "google", callbackURL: "/dashboard" }),
      }),
    );
    expect(response.status).toBe(200);
    const url = new URL((await response.json()).url);
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/google",
    );
    expect(url.searchParams.get("state")).toBeTruthy();
  });
  it("resolves approved Clipmax production and preview hosts to their own OAuth callback URLs", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    const { createAuth } = await import("../src/lib/auth");
    const auth = createAuth();
    const hostConfig = auth.options.baseURL as { allowedHosts: string[] };
    expect(hostConfig.allowedHosts).toContain("clipmax.froshcodeorbit.site");
    expect(hostConfig.allowedHosts).not.toContain("*.vercel.app");
    expect(hostConfig.allowedHosts).not.toContain("untrusted.example.com");
    const startGoogle = async (base: string) => {
      await db.rateLimit.deleteMany();
      return auth.handler(
        new Request(`${base}/api/auth/sign-in/social`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: base,
          },
          body: JSON.stringify({
            provider: "google",
            callbackURL: "/dashboard",
          }),
        }),
      );
    };
    for (const origin of [
      "http://localhost:3000",
      "https://clipmax.froshcodeorbit.site",
      "https://clipmax-beta.vercel.app",
      "https://clipmax-sample-umanor-wisdom-chizoba-s-projects.vercel.app",
    ]) {
      const response = await startGoogle(origin);
      expect(response.status, origin).toBe(200);
      const oauth = new URL((await response.json()).url);
      expect(oauth.searchParams.get("redirect_uri")).toBe(
        `${origin}/api/auth/callback/google`,
      );
    }
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
