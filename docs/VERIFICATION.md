# Verification and remaining launch gates

This is an implementation checkpoint, not completion of all PRD phase gates.

## Latest local results — 15 October 2026

- `npm test`: 14 tests passed across two suites, including actual FFmpeg and PostgreSQL execution.
- `npm run build`: passed, including TypeScript compilation.
- `npm run typecheck`: passed before the final build; the final build also typechecked the latest changes.
- `git diff --check`: passed.
- `npm run test:e2e`: blocked before browser execution because Chromium is not installed; the earlier browser download returned an invalid archive.
- No live-provider processing, cloud deployment or creator review has been completed.

## Automated coverage

- Contract tests cover candidate bounds/overlap and clip-relative captions.
- Media tests generate a synthetic permissioned fixture and execute real FFmpeg cuts in original and padded vertical layouts.
- Embedded PostgreSQL tests apply both migrations and exercise owner isolation, denied foreign enqueue, rounded quota reservation, idempotency conflicts, negative-quota constraints, and tombstone denial.
- Embedded PostgreSQL uses one connection; it does not establish multi-worker race safety or Neon-specific behavior.
- Browser tests exist for landing/auth navigation, input interaction, and mobile overflow. Browser installation was blocked in this environment; do not claim they passed without rerunning.

## Must pass before pilot

1. Configure staging Neon, R2, Resend and OpenAI; run real signup, verification, reset, upload/resume, processing, edit, export and deletion.
2. Evaluate permissioned English/Nigerian English video samples with creators. No measured clip usefulness, cost or production latency is available yet.
3. Exercise concurrent submissions, lease expiry, worker crashes after provider success and after upload, cancellation and deletion races on real PostgreSQL/R2.
4. Validate exact UI fidelity, responsive layout, focus/accessibility and playback in a browser against the supplied reference.
5. Complete monetary cost reconciliation (including script regeneration and ambiguous provider attempts), provider Retry-After/jitter/circuit-breaker handling, operational alerting and restore testing.
6. Add and test an invitation gate, legal/abuse contact, terms acceptance and approved privacy disclosures before public access.
7. Expand fixtures for rotated/variable-frame-rate media, silence, corrupted input, portrait dimensions and subtitle edge cases.

## Design simplifications

The first implementation stores transcript/selection checkpoints as bounded JSON on Project, quota reservations on Job, and revisions/assets as relational rows. It does not yet implement the full specification's separate job-step/audit/cost tables. The web app uses the standard root Next.js layout. The local transcription payload stays below the provider size limit through bounded 30-minute sources and mono 48-kbps extraction; larger media/chunking is out of scope.

These simplifications are explicit implementation gaps where the specification requires additional operational evidence. Do not mark all phases complete simply because the build passes.
