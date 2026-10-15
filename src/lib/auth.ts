import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Resend } from "resend";
import { db } from "./db";
import { required } from "./config";
import { APIError, createAuthMiddleware } from "better-auth/api";
async function email(to: string, subject: string, url: string) {
  const result = await new Resend(required("RESEND_API_KEY")).emails.send({
    from: required("EMAIL_FROM"),
    to,
    subject,
    text: `${subject}\n\n${url}\n\nIf you did not request this, ignore this email.`,
  });
  if (result.error) throw new Error("EMAIL_DELIVERY_FAILED");
}
function createAuth() {
  return betterAuth({
    database: prismaAdapter(db, { provider: "postgresql" }),
    secret: required("BETTER_AUTH_SECRET"),
    baseURL: required("BETTER_AUTH_URL"),
    trustedOrigins: [required("BETTER_AUTH_URL")],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const address =
          typeof ctx.body?.email === "string"
            ? ctx.body.email.trim().toLowerCase()
            : "";
        const invited = (process.env.PILOT_INVITE_EMAILS ?? "")
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean);
        if (!address || !invited.includes(address)) {
          throw new APIError("FORBIDDEN", {
            code: "INVITATION_REQUIRED",
            message:
              "Clipmax is in private testing. Ask the project owner for an invitation.",
          });
        }
        if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
          throw new APIError("SERVICE_UNAVAILABLE", {
            code: "EMAIL_NOT_CONFIGURED",
            message:
              "Account registration is not available yet. Please try again later.",
          });
        }
      }),
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      sendResetPassword: async ({ user, url }) =>
        email(user.email, "Reset your Clipmax password", url),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) =>
        email(user.email, "Verify your Clipmax email", url),
    },
    session: { cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
