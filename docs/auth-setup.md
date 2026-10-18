# Authentication setup

Passwords require at least eight characters (maximum 128). Longer passphrases are welcome. Existing passwords continue to work. Signup requires email verification; password reset revokes existing sessions. Registration is open to everyone. PILOT_INVITE_EMAILS is no longer used.

## Vercel configuration

Configure each intended deployment environment separately. Never paste secrets into chat or commit them.

1. Set DATABASE_URL to the restricted application connection, BETTER_AUTH_SECRET to a strong random secret, and BETTER_AUTH_URL to the exact deployment origin.
2. Configure BREVO_API_KEY and EMAIL_FROM using a verified sending domain.
3. In Google Cloud Console, configure the OAuth consent screen and create an OAuth client of type Web application. Add test users while the Google app is in testing.
4. Add the authorized redirect URI `https://clipmax.froshcodeorbit.site/api/auth/callback/google`. For local development add `http://localhost:3000/api/auth/callback/google`; previews need their own exact origin and callback.
5. Set server-only GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel, then redeploy. Both must be present to enable Google sign-in. The same Google button handles signup and returning login. Only verified Google emails are accepted.
6. Test a new signup, delivered verification link, verified login, wrong password, password reset delivery and token reuse, and Google consent/callback. Check a verified Google identity can create an account without an invitation. Confirm logout and protected dashboard access.

Automated tests use real embedded PostgreSQL and Better Auth, with mocked email transport. They check eight-character boundaries, verification, login, reset token reuse, session revocation, public registration, and OAuth authorization URL generation. They do not establish live Brevo delivery or Google token exchange. Production database/auth/email/Google configuration and live smoke tests remain required before opening accounts.

References: https://better-auth.com/docs/authentication/google and https://better-auth.com/docs/authentication/email-password

## Brevo walkthrough

1. Sign in at https://app.brevo.com. Open Settings → Senders, Domains & Dedicated IPs (the label may appear as Senders & domains).
2. Add `froshcodeorbit.site` under Domains. Authenticate it using the exact DNS records Brevo supplies. Add them at the authoritative DNS host; do not replace existing mail/MX records. If a DMARC record already exists, update the existing record rather than creating a second one. Wait until Brevo confirms authentication.
3. Add a sender named Clipmax with an address you control, for example `hello@froshcodeorbit.site`. Complete sender verification if requested. Brevo sends email; it does not create that inbox.
4. Open SMTP & API → API Keys → generate a new API key named Clipmax. Use an API key, not an SMTP key. Ensure transactional sending is activated for your account.
5. In Vercel → clipmax → Settings → Environment Variables, add `BREVO_API_KEY` and `EMAIL_FROM` (example: `Clipmax <hello@froshcodeorbit.site>`). Select Production for the live site. Use the exact sender registered in Brevo. No email template ID is required.
6. Confirm DATABASE_URL and BETTER_AUTH_SECRET are present in Production. Set BETTER_AUTH_URL to `https://clipmax.froshcodeorbit.site`.
7. Deploy the branch containing the Brevo changes before testing. Changing variables alone does not switch older code from Resend to Brevo. Check Brevo transactional logs after signup/reset.

## Google walkthrough

1. Open https://console.cloud.google.com and create/select a Clipmax project.
2. Open Google Auth Platform. Complete Branding with Clipmax, a support email and developer contact. Use External for the audience and add your Google account under test users while testing. Add `froshcodeorbit.site` as an authorized domain where requested. Provide genuine published privacy/terms URLs if requested; do not invent routes.
3. Under Clients, create an OAuth client of type Web application, named Clipmax Web.
4. Add authorized JavaScript origin `https://clipmax.froshcodeorbit.site` and authorized redirect URI `https://clipmax.froshcodeorbit.site/api/auth/callback/google`. The callback must match exactly.
5. Add the issued client ID and secret to Vercel Production as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Do not use an API key or the secret ID in place of the client secret value.
6. Redeploy and test Continue with Google in a regular browser.

Keep all credentials server-only. Preview configuration does not automatically configure Production. Do not regenerate an existing working BETTER_AUTH_SECRET without planning session invalidation.
