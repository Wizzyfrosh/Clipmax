# Clipmax

Private spoken-video clipping workspace. Next.js + TypeScript, Neon PostgreSQL / Prisma, Better Auth, private Cloudflare R2, Resend, and a separate Node/FFmpeg worker. No Supabase. Generates MP4 clips, source-caption SRT files, original commentary and external voice-generation prompts—not voice audio.

## Status

MVP implementation for local/staging evaluation, **not production-ready**. UI follows the supplied crimson/plum gradient and rounded white auth-sheet reference. Real provider credentials and a permissioned spoken-video evaluation are required. See [verification and launch gaps](docs/VERIFICATION.md). Do not enable unrestricted public signups or processing yet.

## Local setup

Use Node 22.12+ and npm. Install FFmpeg/ffprobe on the worker machine.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and supply server-only credentials. Never commit `.env`.
3. Use a Neon pooled application connection with a bounded pool (`connection_limit=5`); set `DATABASE_URL_UNPOOLED` to a direct migration connection. Use separate runtime and migration roles.
4. Generate a random authentication secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Set the canonical `BETTER_AUTH_URL`.
5. Run `npm run db:generate` and `npm run db:migrate` against your new staging database. Do not reset an existing database.
6. Configure a private R2 bucket and scoped credentials. Permit your exact web origin in CORS with PUT/GET/HEAD, required request headers, and expose ETag. Configure an object expiry backstop and abandoned multipart cleanup; see deployment notes.
7. Configure a verified Resend sender. Verification and password reset require working email delivery.
8. Run `npm run dev` and, separately, `npm run worker`.

Keep `PROCESSING_ENABLED=false` until provider setup and budget review are complete. Select a supported structured-output text model via `TEXT_MODEL`; speech uses timestamped `whisper-1` segments. Enable processing on both web and worker only for controlled testing. Budget values are conservative reservations, not measured provider bills or a guaranteed external spend cap.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Web development server |
| `npm run build` / `npm start` | Production web build/server |
| `npm run worker` | Persistent database-backed processing worker |
| `npm run clip -- <source> <output-directory>` | Local pipeline; requires AI credentials |
| `npm test` | Contract, real FFmpeg, embedded PostgreSQL tests |
| `npm run typecheck` | Strict TypeScript checking |
| `npm run test:e2e` | Public-page browser tests; install Playwright Chromium first |
| `npm run db:migrate` | Apply reviewed migrations |

## Structure

The single web app is in `src/` rather than an extra `apps/web` wrapper. Worker code is in `apps/worker`, shared contracts/media/AI in `packages/`, and reviewed schema/migrations in `prisma/`. Read `AGENTS.md` and `docs/Clipmax_MVP_Build_Specification.md` before changing behavior.

See [deployment](docs/DEPLOYMENT.md) and [verification](docs/VERIFICATION.md). No service has been provisioned or deployed by this repository alone.
