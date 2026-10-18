import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { sendAuthEmail as email, sendVerificationCodeEmail } from "./email";
import { emailOTP } from "better-auth/plugins";
import { db } from "./db";
import { googleConfigured, required } from "./config";
import { APIError, createAuthMiddleware } from "better-auth/api";
export function createAuth() {
  const canonicalURL = required("BETTER_AUTH_URL");
  // Trust only the Clipmax production hosts and deployment URLs in our Vercel
  // account. Never trust all *.vercel.app hosts or disable CSRF validation.
  const allowedHosts = Array.from(
    new Set([
      new URL(canonicalURL).host,
      "clipmax.froshcodeorbit.site",
      "clipmax-beta.vercel.app",
      "clipmax-umanor-wisdom-chizoba-s-projects.vercel.app",
      "clipmax-git-main-umanor-wisdom-chizoba-s-projects.vercel.app",
      "clipmax-*-umanor-wisdom-chizoba-s-projects.vercel.app",
    ]),
  );
  return betterAuth({
    database: prismaAdapter(db, { provider: "postgresql" }),
    secret: required("BETTER_AUTH_SECRET"),
    // Better Auth resolves the origin from a validated request host. This
    // keeps email/session URLs on the same host the visitor is using.
    baseURL: {
      allowedHosts,
      protocol: process.env.NODE_ENV === "production" ? "https" : "auto",
      fallback: canonicalURL,
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
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
    // Email verification is handled only by the OTP plugin, not links.
    // OTP replaces email-verification links; trigger delivery during signup.
    emailVerification: { sendOnSignUp: true },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        storeOTP: "hashed",
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        disableSignUp: true,
        async sendVerificationOTP({ email: address, otp, type }) {
          if (type !== "email-verification") return;
          // No recipient address, OTP or request body in application logs.
          console.info("CLIPMAX_VERIFICATION_EMAIL_DISPATCH");
          await sendVerificationCodeEmail(address, otp);
        },
      }),
    ],
    session: { cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/email-otp/verify-email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
