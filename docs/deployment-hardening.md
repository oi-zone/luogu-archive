# Deployment hardening runbook

This release adds a corrective, fail-closed visibility migration. The earlier
`20260830091000_entity_visibility` migration inferred publication from legacy
rows (including a fail-open Post backfill). Do not use that inference as
authorization: `20260830120000_fail_closed_visibility` revokes it, adds entity
visibility provenance and per-body exposure provenance, and leaves every
legacy Article/Post/Reply body `unverified` until an anonymous fetch observes
that exact body.

Old snapshots may therefore return 404 temporarily. This is intentional. An
entity being currently public does not make an unverified historical snapshot
public.

## Required production sequence

Run every command from the exact release checkout. Keep the site in maintenance
until the new worker has established an initial bounded visibility set.

1. Enter maintenance mode, then back up PostgreSQL and Redis. Keep both backups
   through the observation window.

   ```sh
   pg_dump --format=custom --file=luogu-archive-before-visibility.dump "$DATABASE_URL"
   redis-cli --user "$REDIS_USERNAME" --askpass BGSAVE
   ```

   Copy the resulting RDB/AOF using the platform snapshot mechanism. Never put
   passwords, cookies, or tokens in command arguments or logs.

2. Stop every old worker and confirm it cannot restart.

   ```sh
   pm2 stop worker
   pm2 status
   ```

3. Install the frozen graph and apply all migrations, including
   `20260830120000_fail_closed_visibility` and
   `20260830121000_backfill_resume_state`.

   ```sh
   pnpm install --frozen-lockfile
   pnpm --filter @luogu-discussion-archive/db db:deploy
   ```

4. Run both visibility and stored-body audits. These are dry runs and print
   counts/bytes only.

   ```sh
   pnpm visibility:audit
   pnpm privacy:audit
   ```

5. Inspect Redis, new and legacy queue counts, schedulers, oldest jobs, cursor
   states, and Redis memory.

   ```sh
   pnpm queue:doctor
   pnpm queue:retire
   ```

6. Retire the old `luogu-crawler` queue only after step 2 is independently
   confirmed. The apply command refuses to proceed when an active legacy job
   exists. It removes legacy wait/prioritized/delayed/failed/completed jobs and
   legacy schedulers in bounded batches, then obliterates only the old queue.

   ```sh
   pnpm queue:retire --apply --confirm-old-worker-stopped
   pnpm queue:doctor
   ```

   `pnpm queue:repair` remains available for the narrower legacy stateless
   backfill cleanup. It is normally unnecessary after full retirement.

7. Build/deploy and start the new worker.

   ```sh
   pnpm build
   pnpm --filter worker --prod deploy out/worker/
   pm2 startOrReload out/worker/ecosystem.config.cjs --env production
   ```

8. Inspect scan/cursor/scheduler state, then admit one bounded anonymous
   visibility batch per entity type. The first command is a dry run.

   ```sh
   pnpm visibility:revalidate
   pnpm visibility:revalidate --apply
   pnpm visibility:audit
   pnpm queue:doctor
   ```

   Revalidation uses only no-Cookie public clients, the refresh queue limiter,
   admission control, a 50-row default batch, and persistent keyset progress in
   `VisibilityScanState`. Scheduled scans continue from that progress rather
   than restarting at the first row.

9. Before opening the Web release, confirm sampled public detail, history,
   reply/comment, feed, timeline, trending, recommendation, and `/api/entries`
   queries return only current, non-stale `anonymous_upstream` entities and
   individually verified bodies. Unverified/takedown samples must return 404 or
   a safe empty result.

10. Deploy Web and leave maintenance mode only after step 9 succeeds.

    ```sh
    pnpm --filter web --prod deploy out/web/
    pnpm --dir out/web start
    ```

11. Observe at least one complete scheduler cycle. Confirm structured
    `worker_metrics` shows bounded runnable depth, stable RSS/heap, progressing
    visibility/crawl cursors, rate-limit state, and bounded database pool use.

12. After reviewing the audit and confirming the backup, optionally clear
    unverified/restricted/takedown bodies. This is explicit and irreversible
    without restoring the database backup.

    ```sh
    pnpm privacy:audit
    pnpm privacy:audit --apply
    pnpm privacy:audit
    ```

13. Confirm the production Server Action manifest has no public archive refresh
    action. Controlled refresh remains server-shell-only:

    ```sh
    pnpm archive:enqueue discussion 123456
    pnpm archive:enqueue article abcd1234
    pnpm archive:enqueue paste abcd1234
    ```

    Use `--reopen-backfill` only for a documented gap. It increments the cursor
    version and creates a fresh deterministic job ID; normal refresh never
    resets a pending/active chain.

## Maintenance commands

- `pnpm queue:doctor`: read-only queue, scheduler, cursor, oldest-job, and Redis
  memory diagnostics.
- `pnpm queue:repair`: dry-run detection of old stateless backfill jobs.
  `--apply` removes matching legacy waiting/prioritized jobs only.
- `pnpm queue:retire`: dry-run full old-queue retirement. Mutation requires
  both `--apply` and `--confirm-old-worker-stopped`; any active job aborts it.
- `pnpm visibility:audit`: reports visibility states, stale counts, body
  exposure states, takedown counts, and persistent scan progress. It never
  prints body text.
- `pnpm visibility:revalidate`: dry run. `--apply` admits one bounded scan job
  for Article, Post, and Paste; worker rate limiting performs anonymous checks.
- `pnpm privacy:audit`: reports affected record counts and aggregate bytes for
  PasteSnapshot, ArticleSnapshot, PostSnapshot, ReplySnapshot, and ArticleReply.
  `--apply` clears bodies in batches of 500 and never prints content.

No maintenance mutation runs during application startup.

## Migration and rollback

The corrective migration is additive except for revoking inferred `public`
flags on legacy Article/Post rows. It does not delete body text. The safest code
rollback is:

1. return to maintenance;
2. stop the new worker;
3. deploy the previous code;
4. leave the added columns and `VisibilityScanState` table in place (old code
   ignores them).

Do not reverse the visibility revocation by setting legacy rows public. If a
schema rollback is mandatory, restore the pre-deployment PostgreSQL backup in
an isolated database and validate it before cutover. Queue retirement and
`privacy:audit --apply` are data-destructive and can only be reversed from the
Redis/PostgreSQL backups.

## Runtime configuration

| Variable                                                      |           Default | Purpose                                   |
| ------------------------------------------------------------- | ----------------: | ----------------------------------------- |
| `VISIBILITY_TTL_MS`                                           |       `604800000` | Current visibility validity (7 days)      |
| `VISIBILITY_REVALIDATION_BATCH_SIZE`                          |              `50` | Keyset scan rows per scheduled job        |
| `REFRESH_WORKER_CONCURRENCY`                                  |               `4` | Refresh/revalidation worker concurrency   |
| `BACKFILL_WORKER_CONCURRENCY`                                 |               `1` | Historical worker concurrency             |
| `REFRESH_RATE_LIMIT_MAX` / `REFRESH_RATE_LIMIT_DURATION_MS`   |    `30` / `60000` | Refresh limiter                           |
| `BACKFILL_RATE_LIMIT_MAX` / `BACKFILL_RATE_LIMIT_DURATION_MS` |    `10` / `60000` | Backfill limiter                          |
| `REFRESH_QUEUE_MAX_DEPTH`                                     |            `5000` | Refresh runnable admission ceiling        |
| `BACKFILL_QUEUE_MAX_DEPTH`                                    |           `10000` | Backfill runnable admission ceiling       |
| `QUEUE_JOB_ATTEMPTS`                                          |               `5` | Bounded attempts                          |
| `QUEUE_BACKOFF_DELAY_MS`                                      |            `5000` | Exponential retry base                    |
| `QUEUE_COMPLETED_RETENTION_SECONDS` / `COUNT`                 |   `3600` / `1000` | Completed retention                       |
| `QUEUE_FAILED_RETENTION_SECONDS` / `COUNT`                    | `604800` / `5000` | Failed retention (not runnable pressure)  |
| `BACKFILL_MAX_PAGES_PER_ENTITY`                               |            `1000` | Per-chain pause boundary                  |
| `BACKFILL_CLAIM_TIMEOUT_MS`                                   |          `900000` | Stale active-claim recovery               |
| `BACKFILL_RESUME_INTERVAL_MS`                                 |           `60000` | Pending cursor repair interval            |
| `BACKFILL_RESUME_SCAN_LIMIT`                                  |            `1000` | Oldest-first keyset rows per repair round |
| `WORKER_MAX_CONSECUTIVE_RATE_LIMITS`                          |               `8` | Infinite 429-loop guard                   |
| `WORKER_METRICS_INTERVAL_MS`                                  |           `60000` | Structured diagnostics interval           |
| `WORKER_SHUTDOWN_TIMEOUT_MS`                                  |           `30000` | Active-job drain timeout                  |
| `DB_POOL_MAX`                                                 |              `10` | PostgreSQL pool ceiling                   |
| `DB_IDLE_TIMEOUT_MS`                                          |           `30000` | Idle connection timeout                   |
| `DB_CONNECTION_TIMEOUT_MS`                                    |            `5000` | Connection attempt timeout                |
| `QUEUE_NAME_PREFIX`                                           |             empty | Test-only queue namespace isolation       |

`REDIS_URL` is preferred; discrete Redis host/port/user/password/database/TLS
variables remain supported. `LUOGU_COOKIE` is intentionally unsupported. Logs
are synchronous structured stdout with no application-owned file or remote
buffer. Sentry is opt-in through `SENTRY_DSN`, sends no default PII, and does not
duplicate Pino logs.

## Repository settings code cannot enforce

Configure the GitHub `main` ruleset to require PRs, at least one approving
review, the CI status check, and resolved review conversations. Disable force
pushes, branch deletion, direct pushes, and administrator bypass except for an
audited break-glass procedure. Keep database, Redis, Luogu, Sentry, and deploy
credentials in Actions Secrets or the runtime secret store—not repository
Variables or build-time `.env.local` files.

## Known residual risks

- Anonymous revalidation throughput is intentionally conservative. Large
  legacy archives can return more 404s until the persistent scan catches up.
- Upstream schema changes fail closed and can pause ingestion until validators
  are updated.
- Historical bodies cleared by privacy apply can remain in protected backups;
  backup retention/access policy remains an operator responsibility.
- There is deliberately no browser admin surface. Server-shell access controls
  protect the internal enqueue CLI.
