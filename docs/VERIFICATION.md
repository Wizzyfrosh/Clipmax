# Verification and remaining launch gates

## Groq free-tier adapter — 20 October 2026

Provider selection is explicit via `AI_PROVIDER=groq`. The AI package now uses Groq's OpenAI-compatible API with `whisper-large-v3-turbo` for segmented English transcription and `openai/gpt-oss-20b` for schema-validated clip ranges, commentary and external voice-generation prompts. `AI_PROVIDER=openai` remains an **explicit** alternative only; no automatic paid API fallback.

For the free-tier pilot, configure `GROQ_API_KEY` only on the **separate Node/FFmpeg worker**, not in the browser. Keep `PROCESSING_ENABLED=false` in production until a worker is deployed with private R2 credentials, a database URL, budget variables and a verified small permissioned video. The web API requires monthly budget controls before enqueueing; configure `AI_JOB_BUDGET_MICROS` and `MONTHLY_AI_BUDGET_MICROS` for the paid-provider scenario and monitor real provider limits separately.

Rate-limit errors are mapped to `AI_FREE_TIER_LIMIT` and fail without automatic retries/fallback. Grossly oversized transcript prompts fail fast; longer videos need a bounded chunked-selection flow before production activation. No free tier is a guarantee of unlimited calls or zero hosting charges. Validate Groq provider timestamp granularity and JSON schema compatibility on a live test before accepting public work. 



## Phase 2 — R2 upload readiness and resume hardening (19 October 2026)

The web API now refuses to create new video projects or initiate uploads when the required private R2 variables are absent. The new-project screen explains unavailable uploads instead of creating an unusable record. Existing projects and account authentication remain accessible.

Multipart status returns per-part number, size and ETag from R2. The UI only skips parts after confirming the size and ETag correspond to the exact expected part, and progress reflects confirmed remote parts. Completion also uses the same strict server-side checks. Unit tests cover incomplete, missing, reordered and malformed parts.

**Remaining external requirements:**
1. Create a private Cloudflare R2 bucket and scoped R2 API token with object permissions restricted to that bucket.
2. Set `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET` only in the Vercel environment of the intended deployment; do not expose secrets through `NEXT_PUBLIC_` variables or put them in GitHub.
3. Configure CORS for exactly `https://clipmax.froshcodeorbit.site` using PUT, GET, HEAD; allow Content-Type and required signed headers, and expose ETag. If using a separately authorized staging host, configure it explicitly rather than allowing all origins.
4. Configure abandoned multipart upload cleanup and object-expiry lifecycle rules. Confirm storage retention against user-facing seven-day expiry and worker deletion behavior.
5. Deploy and test one permissioned small MP4, one interrupted/resumed upload, one retry with malformed/missing part, and one completed upload with a running probe worker. Review costs before enabling OpenAI processing.
6. Keep `PROCESSING_ENABLED=false` until live R2/Neon/worker and AI budget safety checks pass.

Automated checks do not prove real R2 CORS behavior, provider authentication, resumable network recovery, or worker availability. Do not mark Phase 2 complete until those live tests pass.



This is an implementation checkpoint, not completion of all PRD phase gates.

## Offline media hardening — 18 October 2026

- Media cancellation and timeout now force termination and wait for process close before returning, allowing safe temporary-file cleanup.
- Subprocess stdout is bounded by bytes; stderr is drained without exposing private paths or untrusted metadata in application errors.
- Rendering rejects unknown layouts and ranges outside the 20–60 second contract before opening input files.
- `npm test`: 30 tests passed, including 14 new subprocess/render-boundary checks plus existing real FFmpeg and embedded PostgreSQL tests. `npm run typecheck`: passed.
- `npm run build`: passed on a clean generated cache after the existing Turbopack cache caused a persistence-read panic. No source or dependency workaround was needed.
- These tests establish local process boundaries, not live-provider reliability, multi-worker race safety, or creator usefulness.

## Latest local results — 15 October 2026

- `npm test`: 16 tests passed across two suites, including actual FFmpeg and PostgreSQL execution.
- `npm run build`: passed, including TypeScript compilation.
- `npm run typecheck`: passed before the final build; the final build also typechecked the latest changes.
- `git diff --check`: passed.
- `npm run test:e2e`: blocked before browser execution because Chromium is not installed; the earlier browser download returned an invalid archive.
- Protected Vercel preview is READY; landing, signin and dashboard returned HTTP 200. No live-provider processing or creator review has been completed.

## Automated coverage

### Staging follow-up

Neon project `Clipmax Staging` (`dawn-tree-28981873`, Frankfurt, PostgreSQL 17) exists. Direct PostgreSQL access from this workspace is unavailable. Both committed migrations were successfully prepared on temporary branch `br-delicate-cherry-b9ytb0gh`: 14 tables, 11 foreign keys, four safety checks and two partial indexes verified. Invalid quota and orphan-session writes were rejected; test records were rolled back. Applied to staging after user approval on 15 October 2026; the temporary branch was deleted.

Prepared migration ID: `88321f3b-6b5d-49af-b90d-878fd2c188c9`; parent branch: `br-flat-feather-b9eiop7j`. The SQL is the two committed migration files concatenated in order. Tool-based SQL application does not update Prisma's migration ledger. Reconcile with `prisma migrate resolve --applied` for both migration directories from a network-enabled environment, then verify `prisma migrate status` before enabling the application. Do not run `migrate deploy` on that baseline until reconciliation.

GitHub Actions run `38685826859` passed, including browser tests, on commit `7935d218df5f9c5d64f6e1a0d11bb069d2d2d733`. The latest invitation-gate changes pass local tests/build; GitHub Actions run 38733902655 also passed on commit f7c33b4f731841334f886d386ad89df8bbc36878.

The protected Vercel preview is deployed with database/auth configuration. Verified email delivery remains pending. Signup now requires an address in `PILOT_INVITE_EMAILS` and configured Brevo credentials. An empty allowlist closes registration. Integration tests verify denied registration creates no account.

- Contract tests cover candidate bounds/overlap and clip-relative captions.
- Media tests generate a synthetic permissioned fixture and execute real FFmpeg cuts in original and padded vertical layouts.
- Embedded PostgreSQL tests apply both migrations and exercise owner isolation, denied foreign enqueue, rounded quota reservation, idempotency conflicts, negative-quota constraints, and tombstone denial.
- Embedded PostgreSQL uses one connection; it does not establish multi-worker race safety or Neon-specific behavior.
- Browser tests exist for landing/auth navigation, input interaction, and mobile overflow. Local browser installation was blocked; the previous commit passed these tests in GitHub Actions.

## Must pass before pilot

1. Configure staging Neon, R2, Brevo and OpenAI; run real signup, verification, reset, upload/resume, processing, edit, export and deletion.
2. Evaluate permissioned English/Nigerian English video samples with creators. No measured clip usefulness, cost or production latency is available yet.
3. Exercise concurrent submissions, lease expiry, worker crashes after provider success and after upload, cancellation and deletion races on real PostgreSQL/R2.
4. Validate exact UI fidelity, responsive layout, focus/accessibility and playback in a browser against the supplied reference.
5. Complete monetary cost reconciliation (including script regeneration and ambiguous provider attempts), provider Retry-After/jitter/circuit-breaker handling, operational alerting and restore testing.
6. Configure the tested invitation gate, and add legal/abuse contact, terms acceptance and approved privacy disclosures before public access.
7. Expand fixtures for rotated/variable-frame-rate media, silence, corrupted input, portrait dimensions and subtitle edge cases.

## Design simplifications

The first implementation stores transcript/selection checkpoints as bounded JSON on Project, quota reservations on Job, and revisions/assets as relational rows. It does not yet implement the full specification's separate job-step/audit/cost tables. The web app uses the standard root Next.js layout. The local transcription payload stays below the provider size limit through bounded 30-minute sources and mono 48-kbps extraction; larger media/chunking is out of scope.

These simplifications are explicit implementation gaps where the specification requires additional operational evidence. Do not mark all phases complete simply because the build passes.

## Staging connection follow-up

- Staging contains all 14 application tables.
- Restricted SQL-created role `clipmax_app` has application-table DML and schema usage. Verified: no superuser, create-role, create-database, bypass-RLS, schema CREATE, or table TRUNCATE privileges.
- The API-created role `clipmax_runtime` inherited Neon administrative membership and is unused. Attempts to revoke membership or disable it were denied by Neon. Its credentials have not been installed in the application; remove this unused role through the Neon control plane during cleanup.
- Prisma migration-history reconciliation remains pending: `prisma migrate resolve` cannot connect from this workspace. Do not run migrations or mark the database baseline complete until the commands below pass from an authorized network-enabled environment.
- After explicit user approval on 15 October, preview database/authentication secrets and conservative configuration were saved for `feature/clipmax-mvp`. Deployment `dpl_4LhBJaqfdUB2867WpEyTrZNvE9hJ` reached READY; the unauthenticated session endpoint returned HTTP 200 with null. This is not a successful signup or complete database integration test. Email, storage, AI and worker configuration remain deferred by the user.
