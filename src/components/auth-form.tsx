"use client";
import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff, ArrowLeft, Check, Scissors } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { GoogleLogo } from "./google-logo";
import { Brand } from "./brand";
type Mode = "sign-in" | "sign-up" | "forgot-password" | "reset-password";
export function AuthForm({
  mode,
  configured,
  googleConfigured = false,
}: {
  mode: Mode;
  configured: boolean;
  googleConfigured?: boolean;
}) {
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("error"))
      setError("Sign-in could not be completed. Please try again.");
  }, []);
  async function googleSignIn() {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
        errorCallbackURL: "/sign-in",
      });
      if (result.error) throw new Error(result.error.message);
    } catch {
      setError("Google sign-in could not be started. Please try again.");
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!configured) {
      setError(
        "Account services are being configured. Please try again later.",
      );
      return;
    }
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim(),
      password = String(form.get("password") ?? "");
    try {
      if (
        (mode === "sign-up" || mode === "reset-password") &&
        password !== form.get("confirm")
      )
        throw Error("Your passwords do not match.");
      if (mode === "sign-up") {
        const r = await authClient.signUp.email({
          name: String(form.get("name")),
          email,
          password,
          callbackURL: "/dashboard",
        });
        if (r.error) throw Error(r.error.message);
        window.location.assign(`/verify-email?email=${encodeURIComponent(email)}`);
      } else if (mode === "sign-in") {
        const r = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/dashboard",
        });
        if (r.error) throw Error(r.error.message);
        window.location.assign("/dashboard");
      } else if (mode === "forgot-password") {
        const r = await authClient.requestPasswordReset({
          email,
          redirectTo: "/reset-password",
        });
        if (r.error) throw Error(r.error.message);
        setMessage(
          "If that email has an account, you will receive a reset link.",
        );
      } else {
        const token =
          new URLSearchParams(window.location.search).get("token") ?? "";
        const r = await authClient.resetPassword({
          newPassword: password,
          token,
        });
        if (r.error) throw Error(r.error.message);
        setMessage("Password updated. You can sign in now.");
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const signup = mode === "sign-up",
    signin = mode === "sign-in";
  return (
    <main className="auth-page">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <div className="auth-top">
        <Brand />
        <Link href="/" className="back">
          <ArrowLeft size={16} /> Back to home
        </Link>
      </div>
      <div className="auth-layout">
        <aside className="auth-story">
          <span className="eyebrow">YOUR STORY, REIMAGINED</span>
          <h1>
            Make room for
            <br />
            <em>your best moments.</em>
          </h1>
          <p>
            Less time finding the perfect cut.
            <br />
            More time creating something worth watching.
          </p>
          <div className="story-icon">
            <Scissors size={56} />
          </div>
          <div className="story-foot">
            <span>01 — UPLOAD</span>
            <span>02 — CLIP</span>
            <span>03 — CREATE</span>
          </div>
        </aside>
        <section className="auth-card">
          <div className="auth-banner">
            <span className="card-kicker">CLIPMAX / CREATOR WORKSPACE</span>
            <h2>
              {signup ? (
                <>
                  Create your
                  <br />
                  account.
                </>
              ) : signin ? (
                <>
                  Hello,
                  <br />
                  sign in!
                </>
              ) : mode === "forgot-password" ? (
                <>
                  Let's get you
                  <br />
                  back in.
                </>
              ) : (
                <>
                  A fresh start.
                  <br />
                  New password.
                </>
              )}
            </h2>
            <span className="banner-dots">•••</span>
          </div>
          <form className="auth-sheet" onSubmit={submit}>
            {(signin || signup) && (
              <>
                <button
                  type="button"
                  className="button google-auth-button"
                  disabled={busy || !configured || !googleConfigured}
                  onClick={googleSignIn}
                >
                  <GoogleLogo /> Continue with Google
                </button>
                {!googleConfigured && (
                  <p className="fine-print">
                    Google sign-in is awaiting configuration.
                  </p>
                )}
                <p className="fine-print">Or continue with your email</p>
              </>
            )}
            {signup && (
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="Your name"
                  required
                  maxLength={100}
                />
              </label>
            )}
            {mode !== "reset-password" && (
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>
            )}
            {mode !== "forgot-password" && (
              <label>
                Password
                <div className="password-field">
                  <input
                    name="password"
                    aria-label="Password"
                    type={show ? "text" : "password"}
                    autoComplete={signin ? "current-password" : "new-password"}
                    minLength={signin ? 1 : 8}
                    placeholder={
                      signin ? "Enter your password" : "At least 8 characters"
                    }
                    required
                  />
                  <button
                    type="button"
                    className="eye"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
            )}
            {(signup || mode === "reset-password") && (
              <label>
                Confirm password
                <input
                  name="confirm"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter password again"
                  required
                  minLength={8}
                />
              </label>
            )}
            {signin && (
              <Link href="/forgot-password" className="forgot">
                Forgot password?
              </Link>
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="notice success" role="status">
                <Check size={16} />
                {message}
              </p>
            )}
            <button
              disabled={busy}
              className="button auth-submit"
              type="submit"
            >
              {busy
                ? "PLEASE WAIT…"
                : signup
                  ? "SIGN UP"
                  : signin
                    ? "SIGN IN"
                    : mode === "forgot-password"
                      ? "SEND RESET LINK"
                      : "UPDATE PASSWORD"}
            </button>
            {signup && (
              <p className="fine-print">
                Already registered but haven't received your verification code?{" "}
                <Link className="verify-link" href="/verify-email">Verify your email</Link>
              </p>
            )}
            {signup && (
              <p className="fine-print">
                Your videos are private. Only upload content you own or have
                permission to use.
              </p>
            )}
            <p className="auth-switch">
              {signup
                ? "Already have an account?"
                : signin
                  ? "Don't have an account?"
                  : "Ready to return?"}{" "}
              <Link href={signin ? "/sign-up" : "/sign-in"}>
                {signin ? "Sign up" : "Sign in"}
              </Link>
            </p>
            <div className="sheet-indicator" />
          </form>
        </section>
      </div>
      <p className="auth-bottom">A little less editing. A lot more creating.</p>
    </main>
  );
}
