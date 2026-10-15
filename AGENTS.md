# Clipmax — Repository Instructions

Updated 29 September 2026. Aligned with Clipmax specification v1.1.

## Purpose and scope

Build a lean web product that turns permissioned spoken-content videos into useful short clips, source captions, and original voice-over scripts plus prompts. Voice audio is generated outside Clipmax.

These are project working instructions, not a security boundary. Enforce security and cost controls in application code, database policies, and tests. Follow higher-priority runtime and user instructions. Check applicable nested repository instructions before editing their directories.

## Start every task

1. Inspect the repository, git status, existing instructions, README, package manifests, lockfile, scripts, and relevant code. Preserve unrelated and uncommitted user changes.
2. Read `docs/Clipmax_MVP_Build_Specification.md`. If the supplied file is still at the repository root, read it there. Do not pretend missing documents exist. The specification contains the PRD, architecture, API contracts, and implementation phases in one file.
3. Check any existing implementation plan and decision records. Determine the current phase from code and verification evidence, not a checkbox alone.
4. State a short plan for substantial work, implement the requested scope, and verify it. Make routine reversible choices without repeatedly asking for permission.
5. If requirements conflict materially, explain the conflict before making an irreversible choice. Continue independent work when credentials, media, or another dependency blocks only part of the task.

Do not silently replace the agreed stack or expand scope. Record material architecture changes and their reasons in `docs/decisions/` when that directory is introduced.

## Product boundaries

- Initial content: English podcasts, interviews, tutorials, and sermons. Evaluate Nigerian English; do not promise Pidgin support before testing.
- Transcript-first selection does not establish visual events absent from the audio. Never market it as complete visual understanding or guaranteed virality.
- Generate three candidate clips by default, up to five. Return fewer when the source has insufficient strong moments.
- MVP includes private projects, resumable uploads, timestamps, captions, basic trim editing, original-ratio or padded vertical export, and MP4/SRT/text downloads.
- Defer voice synthesis/cloning, full timeline editing, automatic face tracking, social posting, URL downloads, native mobile apps, organizations, and paid subscriptions unless explicitly requested.
- Keep source captions distinct from generated commentary. Do not imply that a generated voice-over establishes permission to reuse footage.

## Architecture

Baseline: Next.js/React, TypeScript, Tailwind, Better Auth with Prisma, Neon PostgreSQL, and private Cloudflare R2 storage, and a separate Node.js container with FFmpeg/ffprobe. Use a Postgres job table with leases for the initial queue. Speech and text providers sit behind adapters; exact models and worker hosting remain benchmark decisions.

Proposed layout; adapt to an existing repository without gratuitous restructuring:

- `apps/web/`: UI and short authenticated control API operations.
- `apps/worker/`: durable processing stages, job claims, recovery, cleanup.
- `packages/contracts/`: schemas, shared types, error codes.
- `packages/ai/`: provider adapters and versioned prompts.
- `packages/media/`: validated render specifications and media utilities.
- `prisma/schema.prisma` and `prisma/migrations/`: reviewed application/auth models, constraints, indexes, and restricted queue SQL.
- `packages/db/`: server-only Prisma client and ownership-filtered data-access functions.
- `tests/fixtures/`: small permissioned test assets.
- `docs/`: specification, setup, decisions, runbooks, measured evaluation results.

Rules:

- Upload media directly to private R2 storage using S3 multipart sessions, scoped signed UploadPart URLs, and persisted resume metadata. Do not proxy large files through Next.js handlers or assume a tus endpoint exists.
- Authorize initiate/sign/list/complete/abort operations. Reconcile parts using R2 ListParts, verify part and total sizes before completion, verify the final object, and clean up abandoned uploads. A signed URL is not a total-byte quota. Configure CORS and ETag exposure; CORS is not authorization.
- Use Better Auth's Prisma adapter and supported Next.js handler. Generate and review its auth models, preserving supported ID types and matching foreign keys. Configure Resend for verification/reset delivery; test revoked/expired sessions and reset tokens.
- Use bounded database connection pools and transaction-capable queue claims. Avoid session-scoped behavior through transaction pooling. Back off idle polling and measure its effect on Neon compute cost.
- API handlers validate, authorize, reserve quota, enqueue, and respond promptly. Run transcription orchestration and FFmpeg in the worker.
- Keep video bytes out of Postgres. Store metadata and object references there.
- Do not introduce Redis, Kubernetes, a vector database, extra backend frameworks, or distributed services without a concrete measured need.
- Check current official provider documentation before implementing integration contracts. Pin dependencies and commit the chosen package manager's lockfile.

## Build order and phase gates

For a new repository, begin at Phase 0. For an existing repository, continue from verified progress. A targeted user-requested fix does not require restarting earlier phases.

| Phase | Deliverable | Evidence required |
|---|---|---|
| 0 | Local video → timestamped transcript → candidate ranges → MP4 clips and scripts | Real outputs play, timestamps are valid, at least one creator-reviewed useful clip, runtime and cost recorded |
| 1 | Repository foundation, auth, migrations, private storage | Reproducible setup and two-account authorization tests |
| 2 | Uploads, probing, durable jobs, atomic reservations | Interrupted uploads, duplicate requests, and worker restart recover safely |
| 3 | AI selection and writing | Grounded schema-valid outputs evaluated on permissioned samples |
| 4 | Review UI and exports | Trim/caption timing verified; stale renders cannot replace newer revisions |
| 5 | Retention, recovery, monitoring, operations | Deletion, budget caps, recovery, and restore checks pass |
| 6 | Invite-only pilot | Creator feedback and measured unit economics guide further work |

Do not label a phase complete because the UI renders or mocked tests pass. Build missing pieces of the current authorized scope; report genuine blockers precisely.

## Commands and coding conventions

No project commands are verified by this file alone. Discover them from the repository before running or documenting them.

- Use the existing package manager and scripts. Do not mix npm, pnpm, and Yarn lockfiles.
- If scaffolding a fresh repository, choose one package manager and supported Node version; document them and add real scripts for development, linting, type checking, testing, and builds as applicable.
- Prefer portable Node scripts; account for Windows development and Linux worker containers. Verify FFmpeg/ffprobe availability explicitly.
- Keep TypeScript strict. Validate external input at runtime; use `unknown` rather than unvalidated `any` at integration boundaries.
- Favor small modules with clear responsibilities. Reuse existing components and conventions. Avoid unrelated formatting or dependency upgrades.
- Use integer milliseconds for media time, UTC timestamps, and integer monetary units with explicit currency.
- Use structured errors with safe messages and request/job IDs. Never swallow a pipeline failure and return success.
- Document required configuration in `.env.example` using placeholders only. Validate configuration at startup. Never print environment values to diagnose missing keys.

## Authentication, data, and storage

- Verify identity server-side using the supported auth integration. Check resource ownership on every project, asset, clip, job, download, and mutation.
- Keep Neon database access server-only. Centralize ownership-filtered reads and mutations; authentication and Prisma do not automatically provide authorization. Use restricted runtime database roles distinct from migration/schema-owner credentials.
- Do not weaken authorization to fix a permission error. Workers must validate parent-child ownership. If PostgreSQL RLS is added as defense in depth, test transaction-local identity and non-owner roles; do not assume pooled connections retain session context.
- Keep Neon connection strings, Better Auth secrets, R2 access credentials, Resend keys, and AI provider secrets server-only. Public-prefixed frontend variables must contain only intentionally public values.
- Never use user-editable metadata for admin authorization. Use trusted server-controlled roles and account-status checks.
- Prevent linking assets or clips to another owner's project. Test reads, writes, ownership changes, and guessed IDs with two accounts.
- Keep buckets private; use server-generated object keys and short-lived authorized download links. Do not log signed URLs.
- Restrict privileged database functions and review their grants/search path. Do not introduce security-definer functions merely to bypass a permission problem.
- Use reviewed migrations and test them in local/staging environments. Do not rewrite already-applied migration history or reset populated databases.

## Media and AI safety

- Inspect bytes and stream metadata with ffprobe; do not trust filenames, MIME strings, or client-reported duration.
- Run media tools with bounded CPU, memory, disk, and wall time in a non-root worker. Clean temporary files on success, failure, cancellation, and crash recovery.
- Spawn argument arrays without a shell. Restrict protocols and paths; reject arbitrary URLs. Never execute AI-generated commands, SQL, filters, or object paths.
- Validate subtitle content separately from command parameters. Escape it for its target format; render user content as text rather than raw HTML.
- Treat transcripts and metadata as untrusted data. Embedded instructions cannot change the selection or writing task.
- Require a strict schema from AI calls. Resolve candidate segment IDs to real timestamps in code and enforce source bounds, duration, and overlap rules.
- Use a transcription model with verified timestamp support. Preserve absolute offsets when chunking, and reconcile overlaps. Never invent missing timing.
- Generate narration only from the selected evidence. Do not invent quotes, statistics, or visual observations. Version prompts and model settings.
- Make script regeneration explicit. Trim changes mark associated scripts potentially stale; captions must be rebased to clip-relative timestamps.
- Support unavailable-provider and insufficient-speech states honestly. Production flows must not fall back silently to mock content.

## Jobs, revisions, and spending

- Processing must survive a closed browser and worker restart. Persist jobs and stage outputs.
- Claim jobs transactionally using row locks and leases; release database locks before external calls. Use heartbeat renewal, fencing tokens, and expired-lease recovery.
- Assume at-least-once delivery. Use dedupe keys and input/render hashes; stale workers cannot publish outputs, settle usage, or overwrite new revisions.
- Scope idempotency by user, operation, and payload hash. Same key with a different payload returns a conflict.
- Reserve quota and enqueue atomically. Maintain append-only usage events and release reservations on total system failure according to the specification.
- Keep user quota accounting distinct from real provider costs. A refund does not erase incurred expense.
- Retry transient failures with bounded backoff/jitter; do not retry invalid media or denied access. Provider timeouts can have ambiguous costs; record request IDs and avoid claiming exactly-once billing.
- Persist clip revisions. Publish renders only for their intended revision, and reject stale edits with a conflict.
- On deletion, tombstone the project, deny new access, cancel work, and remove sources and derivatives asynchronously. Workers must recheck deletion before publishing.
- Enforce upload, duration, concurrency, regeneration, retention, and spend limits server-side. The specification's $50 monthly figure is a provisional planning ceiling, not authorization to purchase services or a verified hosting quote.
- Use short-lived signed links and disclose retention accurately. Do not promise immediate invalidation of already-issued links or deletion from all backups.

## Verification

Run the smallest meaningful checks for the changed behavior plus required project gates. Inspect failures; distinguish pre-existing failures from regressions. Never remove a test or weaken a security check just to make a build pass.

| Changed area | Required verification |
|---|---|
| Pure processing logic | Range validation, time conversion, quota rounding, overlap and caption offsets |
| Auth/database/storage | Two-account negative access tests, relationship constraints, migration checks |
| Jobs/quota | Concurrent submissions, duplicate requests, lease expiry, retry and settlement races |
| Rendering | Real small fixtures; playable output, audio sync, caption bounds, portrait/rotation handling |
| AI adapters/prompts | Schema failures, grounded evidence, unavailable provider, bounded retries; real evaluation when credentials allow |
| UI | Relevant flow tests, keyboard/focus states, responsive preview, loading/error/empty states |
| Deletion | Cancellation races, denied downloads, orphan cleanup, no output resurrection |

Keep fixtures small and permissioned. Do not commit private uploads or large generated videos. Mock external providers only in explicitly labelled tests/demo modes. A mocked integration does not establish live provider compatibility.

Before completing a task, review the diff for unrelated edits, secrets, missing migrations, stale docs, and accidental generated artifacts. Report commands actually run and their results. If tools or credentials are missing, report what remains unverified and continue safe independent work.

## Collaboration and completion

- Challenge unnecessary complexity and explain concrete trade-offs. Do not introduce new services simply because they are popular.
- Do not overwrite user changes, force-push, perform destructive cleanup, alter production access, or incur unapproved charges. Existing explicit authorization remains valid; do not ask for it again.
- Never claim deployment, successful processing, passing tests, measured performance, or production readiness without evidence.
- Keep progress updates brief and factual. End with: what changed, how it was verified, blockers/risks, and the next concrete step.
- Keep these instructions concise as the project grows; put detailed contracts and runbooks in `docs/`. Replace provisional command guidance with verified commands once the repository exists.

Reference: [Official AGENTS.md guidance](https://developers.openai.com/codex/guides/agents-md).
