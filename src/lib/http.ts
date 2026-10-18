import { headers } from "next/headers";
import { getAuth } from "./auth";
import { db } from "./db";
import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export async function user() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) throw new HttpError(401, "SIGN_IN_REQUIRED");
  if (!session.user.emailVerified) throw new HttpError(403, "VERIFY_EMAIL");
  const row = await db.user.findUnique({
    where: { id: session.user.id },
    select: { suspended: true },
  });
  if (!row || row.suspended) throw new HttpError(403, "ACCOUNT_UNAVAILABLE");
  return session.user;
}
export function origin(req: Request) {
  if (
    !["GET", "HEAD"].includes(req.method) &&
    req.headers.get("origin") !== process.env.BETTER_AUTH_URL
  )
    throw new HttpError(403, "INVALID_ORIGIN");
}
export async function body(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "INVALID_JSON");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 100_000) {
      await reader.cancel();
      throw new HttpError(413, "BODY_TOO_LARGE");
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "INVALID_JSON");
  }
}
export function failure(error: unknown) {
  const requestId = crypto.randomUUID();
  if (error instanceof HttpError)
    return Response.json(
      { code: error.code, requestId },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return Response.json(
      {
        code: "INVALID_INPUT",
        issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
        requestId,
      },
      { status: 422 },
    );
  const config = error instanceof Error && error.message.startsWith("CONFIG_");
  console.error(
    JSON.stringify({
      requestId,
      code: config ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR",
      type: error instanceof Error ? error.name : "Unknown",
    }),
  );
  return Response.json(
    { code: config ? "SERVICE_NOT_CONFIGURED" : "INTERNAL_ERROR", requestId },
    { status: 503 },
  );
}
export async function ownedProject(id: string, ownerId: string) {
  const p = await db.project.findFirst({
    where: { id, ownerId, deletedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!p) throw new HttpError(404, "PROJECT_NOT_FOUND");
  return p;
}
