"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, MailCheck, RotateCw } from "lucide-react";
import Link from "next/link";
import { Brand } from "./brand";
import { authClient } from "@/lib/auth-client";

export function VerifyEmailForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const address = new URLSearchParams(window.location.search).get("email");
    if (address) setEmail(address);
  }, []);
  useEffect(() => {
    if (cooldown < 1) return;
    const timer = window.setTimeout(() => setCooldown((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || busy || !/^\d{6}$/.test(code) || !email.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await authClient.emailOtp.verifyEmail({
        email: email.trim().toLowerCase(),
        otp: code,
      });
      if (result.error) throw new Error(result.error.message ?? "Invalid or expired code.");
      setVerified(true);
      setCode("");
      setMessage("Your email has been verified. You can now sign in.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Verification failed. Request a new code and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!configured || resending || cooldown > 0 || !email.trim()) return;
    setResending(true);
    setError("");
    setMessage("");
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(),
        type: "email-verification",
      });
      if (result.error) throw new Error(result.error.message ?? "Could not send verification code.");
      setCooldown(60);
      setCode("");
      setMessage("A new code was requested. Check your inbox and spam folder.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to request another code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <div className="auth-top">
        <Brand />
        <Link className="back" href="/sign-in"><ArrowLeft size={16} /> Back to sign in</Link>
      </div>
      <div className="auth-layout">
        <aside className="auth-story">
          <span className="eyebrow">ALMOST THERE</span>
          <h1>Every great clip <em>starts here.</em></h1>
          <p>Confirm your email to unlock the Clipmax creator workspace.</p>
          <div className="story-icon"><MailCheck size={54} /></div>
          <div className="story-foot"><span>01 — SIGN UP</span><span>02 — VERIFY</span><span>03 — CREATE</span></div>
        </aside>
        <section className="auth-card">
          <div className="auth-banner">
            <span className="card-kicker">CLIPMAX / SECURE VERIFICATION</span>
            <h2>{verified ? "You're verified." : "Check your inbox."}</h2>
          </div>
          <form className="auth-sheet" onSubmit={verify}>
            {verified ? (
              <>
                <div className="verify-success-icon"><CheckCircle2 size={32} /></div>
                <p className="notice success" role="status">{message}</p>
                <Link href="/sign-in" className="button auth-submit">CONTINUE TO SIGN IN</Link>
              </>
            ) : (
              <>
                <p className="fine-print">Enter the six-digit code sent to your email. Your code expires after 5 minutes.</p>
                <label htmlFor="verify-email-address">Email address
                  <input id="verify-email-address" type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </label>
                <label htmlFor="verify-email-code">Verification code
                  <input id="verify-email-code" className="verification-code-input" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={12} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required />
                </label>
                {error && <p className="notice error" role="alert">{error}</p>}
                {message && <p className="notice success" role="status">{message}</p>}
                {!configured && <p className="notice error" role="alert">Account services are not configured.</p>}
                <button className="button auth-submit" disabled={busy || !configured || code.length !== 6} type="submit">{busy ? "VERIFYING…" : "VERIFY EMAIL"}</button>
                <button className="verify-resend" type="button" onClick={resend} disabled={!configured || resending || cooldown > 0 || !email.trim()}>
                  <RotateCw size={15} /> {resending ? "Requesting…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend code"}
                </button>
                <p className="fine-print">Check your spam folder. Codes are single-use and limited to five attempts. Already verified? <Link className="verify-link" href="/sign-in">Sign in</Link>.</p>
              </>
            )}
            <div className="sheet-indicator" />
          </form>
        </section>
      </div>
      <p className="auth-bottom">A little less editing. A lot more creating.</p>
    </main>
  );
}
