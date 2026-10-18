import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { sendAuthEmail as email } from "./email";
import { db } from "./db";
import { googleConfigured, required } from "./config";
import { APIError, createAuthMiddleware } from "better-auth/api";
function invited(email: string) {
  return (process.env.PILOT_INVITE_EMAILS ?? "")
    .split(",")
    .some(
      (value) =>
        value.trim().toLowerCase() === email.trim().toLowerCase() &&
        email.trim() !== "",
    );
}
export function createAuth() {
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
        if (!invited(address)) {
          throw new APIError("FORBIDDEN", {
            code: "INVITATION_REQUIRED",
            message:
              "Clipmax is in private testing. Ask the project owner for an invitation.",
          });
        }
        if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM) {
          throw new APIError("SERVICE_UNAVAILABLE", {
            code: "EMAIL_NOT_CONFIGURED",
            message:
              "Account registration is not available yet. Please try again later.",
          });
        }
      }),
    },
    socialProviders: googleConfigured()
      ? {
          google: {
            clientId: required("GOOGLE_CLIENT_ID"),
            clientSecret: required("GOOGLE_CLIENT_SECRET"),
            prompt: "select_account",
          },
        }
      : {},
    user: {
      validateUserInfo: async ({ user, source }) => {
        if (source.method === "oauth" && user.emailVerified !== true)
          return { error: "email_not_verified" };
        if (source.action === "create-user" && !invited(user.email ?? ""))
          return { error: "invitation_required" };
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
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
