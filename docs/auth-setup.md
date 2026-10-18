# Authentication setup

Passwords require at least eight characters (maximum 128). Longer passphrases are welcome. Existing passwords continue to work. Signup requires email verification; password reset revokes existing sessions. Both email and Google account creation require an address in PILOT_INVITE_EMAILS. An empty list closes registration.

## Vercel configuration

Configure each intended deployment environment separately. Never paste secrets into chat or commit them.

1. Set DATABASE_URL to the restricted application connection, BETTER_AUTH_SECRET to a strong random secret, and BETTER_AUTH_URL to the exact deployment origin.
2. Configure RESEND_API_KEY and EMAIL_FROM using a verified sending domain. Add invited email addresses to PILOT_INVITE_EMAILS.
3. In Google Cloud Console, configure the OAuth consent screen and create an OAuth client of type Web application. Add test users while the Google app is in testing.
4. Add the authorized redirect URI `https://clipmax.froshcodeorbit.site/api/auth/callback/google`. For local development add `http://localhost:3000/api/auth/callback/google`; previews need their own exact origin and callback.
5. Set server-only GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel, then redeploy. Both must be present to enable Google sign-in. The same Google button handles signup and returning login. Only verified Google emails are accepted.
6. Test an invited signup, delivered verification link, verified login, wrong password, password reset delivery and token reuse, and Google consent/callback. Check an uninvited Google identity cannot create an account. Confirm logout and protected dashboard access.

Automated tests use real embedded PostgreSQL and Better Auth, with mocked email transport. They check eight-character boundaries, verification, login, reset token reuse, session revocation, invitation enforcement, and OAuth authorization URL generation. They do not establish live Resend delivery or Google token exchange. Production database/auth/email/Google configuration and live smoke tests remain required before opening accounts.

References: https://better-auth.com/docs/authentication/google and https://better-auth.com/docs/authentication/email-password
