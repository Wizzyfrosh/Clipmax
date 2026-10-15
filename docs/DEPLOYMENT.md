# Staging deployment and operations

## Web

Deploy the repository root as a Next.js application. Build with `npm run build`. Set the server environment from `.env.example`; do not prefix secrets with NEXT_PUBLIC. Set BETTER_AUTH_URL to the exact HTTPS origin and match the R2 CORS origin. Run migrations once as a controlled release step using the migration role, not on each web request.

## Worker

Build `docker build -f apps/worker/Dockerfile -t clipmax-worker .`. The image runs as non-root. Run one instance initially, with shared database and R2 configuration, a 2-CPU / 4-GB starting limit, read-only root filesystem, and a writable `/tmp` volume capped at 4 GB. These are starting limits requiring a benchmark, not capacity promises. Example:

```sh
docker run --init --read-only --cpus=2 --memory=4g --pids-limit=128 --tmpfs /tmp:rw,size=4g --env-file .env clipmax-worker
```

Do not run FFmpeg inside a web request. The worker serializes jobs globally and polls with idle backoff; this can keep database compute awake. Budget for an always-running worker and database usage. Stop new work before rolling releases; allow sufficient graceful shutdown time for an active job. Expired leases are reclaimed.

## Storage and deletion

Keep the bucket private. Allow only your exact web origins for uploads. Add lifecycle rules to abort abandoned multipart uploads after one day and expire objects after eight days as a backstop for crash-orphaned uploads; user-facing expiry remains seven days. Confirm rule semantics and deletion lag in your actual account before launch. Worker cleanup must remain running to remove live objects and textual derivatives. Previously issued signed URLs can remain usable for up to five minutes after deletion.

## Launch controls

- Keep PROCESSING_ENABLED false until a real end-to-end staging run passes.
- Restrict deployment access to invited testers until an application invitation gate is implemented and tested.
- Review AI_JOB_BUDGET_MICROS against the selected model, maximum input, output, and all retries. Current reservations are admission controls, not actual cost reconciliation. Configure provider-side limits too.
- Restrict runtime database roles to required application DML; migrations use a separate schema owner.
- Configure monitoring for stuck jobs, stale leases, failed deletion, disk pressure, provider failures, and budget usage. Current console logs alone are not sufficient alerting.
- Rehearse database restore and define object backup policy. No restore has been verified yet.
- Add privacy, terms, and an abuse/removal contact before public access.

## Rollback

Pause processing, roll back application/worker images, and preserve forward-compatible migrations and all user data. Never reset a populated database to recover a failed release. Inspect queued job payload compatibility before resuming.
