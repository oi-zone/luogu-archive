# Deployment hardening runbook

This release introduces the `luogu-refresh` and `luogu-backfill` queues, the
`CrawlCursor` table, public visibility enforcement, and destructive maintenance
commands that are deliberately never run during application startup.

## Required production sequence

Run every command from the exact release checkout. Do not mix an old worker
with the new cursor table and queues.

1. Back up PostgreSQL and Redis. Keep both backups until the observation window
   is complete.

   ```sh
   pg_dump --format=custom --file=luogu-archive-before-hardening.dump "$DATABASE_URL"
   redis-cli --user "$REDIS_USERNAME" --askpass BGSAVE
   ```

   Copy the resulting Redis RDB/AOF with the deployment platform's supported
   snapshot mechanism. Do not put credentials on the command line or in logs.

2. Stop the old worker. Put the old web release behind a maintenance response
   (or at minimum block `/p/*` and `/api/entries`) until step 9; read-only mode
   alone does not close the old private-paste read path.

   ```sh
   pm2 stop worker
   ```

3. Install only the frozen dependency graph and apply the additive migrations.

   ```sh
   pnpm install --frozen-lockfile
   pnpm --filter @luogu-discussion-archive/db db:deploy
   ```

4. Report private entities that still retain bodies. This is a dry run.

   ```sh
   pnpm privacy:audit
   ```

5. Inspect Redis, all queue counts, oldest work, scheduler state, cursor state,
   and legacy backfills.

   ```sh
   pnpm queue:doctor
   ```

6. Preview, then explicitly remove only waiting/prioritized legacy stateless
   backfill jobs. Active jobs and schedulers are never removed.

   ```sh
   pnpm queue:repair
   pnpm queue:repair --apply
   ```

7. Build and deploy the new worker, then start it with the updated PM2 config.

   ```sh
   pnpm build
   pnpm --filter worker --prod deploy out/worker/
   pm2 startOrReload out/worker/ecosystem.config.cjs --env production
   ```

8. Confirm the refresh scheduler, backfill queue, and cursor states.

   ```sh
   pnpm queue:doctor
   pm2 logs worker --lines 100
   ```

9. Deploy the web artifact only after the worker is healthy, then remove the
   maintenance response. The artifact must come from
   `pnpm install --frozen-lockfile`; never rerun an unfrozen install in the
   deploy stage.

   ```sh
   pnpm --filter web --prod deploy out/web/
   pnpm --dir out/web start
   ```

   Replace the foreground `start` command with the platform's equivalent
   process-manager reload when applicable.

10. Observe at least one complete scheduling cycle. Confirm that
    `worker_metrics` reports bounded queue depth, stable RSS/heap, database pool
    counts, and no continuously increasing backfill age.

11. After reviewing the dry-run totals and confirming the PostgreSQL backup,
    clear bodies retained for currently private pastes.

    ```sh
    pnpm privacy:audit --apply
    pnpm privacy:audit
    ```

    The second command must report zero stored private bodies. The apply command
    never prints content.

12. Confirm that the homepage, not-found pages, entity operation panels, and
    compiled Server Action manifest contain no public refresh action. Enqueue a
    controlled test only from the server shell:

    ```sh
    pnpm archive:enqueue discussion 123456
    pnpm archive:enqueue article abcd1234
    pnpm archive:enqueue paste abcd1234
    ```

    Use `--reopen-backfill` only for a documented archive gap. Ordinary refresh
    never resets a completed cursor.

## Maintenance command behavior

`pnpm queue:doctor` is read-only. `pnpm queue:repair` is also a dry run.
Deletion requires the exact `pnpm queue:repair --apply` spelling. Repair scans
in bounded batches and removes only legacy waiting/prioritized jobs whose old
priority/deduplication signature identifies stateless discussion or article
reply backfill. It never removes active jobs or scheduler definitions.

`pnpm privacy:audit` reports entity count, snapshot count, and aggregate stored
bytes only. `--apply` sets historical bodies to `NULL` when the entity's current
visibility state is private or restricted. Restore the PostgreSQL backup if
those bodies are needed for a legally authorized non-public recovery workflow.

## Migration and rollback

Migrations `20260830090000_crawl_cursor` and
`20260830091000_entity_visibility` are additive. To roll the application back,
stop the new worker first, restore the previous release, and keep the new table
and columns in place; old code ignores them. If they must be removed after all
new workers are stopped, the schema-only rollback is:

```sql
DROP TABLE "CrawlCursor";
ALTER TABLE "Paste" DROP COLUMN "public";
ALTER TABLE "Article" DROP COLUMN "public";
ALTER TABLE "Post" DROP COLUMN "public";
```

Queue repair and `privacy:audit --apply` remove data and cannot be reversed by
an application rollback. Restore the pre-deployment Redis/PostgreSQL backups
when that data must be recovered.

## Runtime configuration

All defaults are conservative and can be overridden with environment variables:

| Variable                                                      |           Default | Purpose                         |
| ------------------------------------------------------------- | ----------------: | ------------------------------- |
| `REFRESH_WORKER_CONCURRENCY`                                  |               `4` | Refresh worker concurrency      |
| `BACKFILL_WORKER_CONCURRENCY`                                 |               `1` | Historical worker concurrency   |
| `REFRESH_RATE_LIMIT_MAX` / `REFRESH_RATE_LIMIT_DURATION_MS`   |    `30` / `60000` | Refresh limiter                 |
| `BACKFILL_RATE_LIMIT_MAX` / `BACKFILL_RATE_LIMIT_DURATION_MS` |    `10` / `60000` | Backfill limiter                |
| `REFRESH_QUEUE_MAX_DEPTH`                                     |            `5000` | Refresh admission ceiling       |
| `BACKFILL_QUEUE_MAX_DEPTH`                                    |           `10000` | Backfill admission ceiling      |
| `QUEUE_JOB_ATTEMPTS`                                          |               `5` | Bounded attempts                |
| `QUEUE_BACKOFF_DELAY_MS`                                      |            `5000` | Exponential retry base          |
| `QUEUE_COMPLETED_RETENTION_SECONDS` / `COUNT`                 |   `3600` / `1000` | Completed retention             |
| `QUEUE_FAILED_RETENTION_SECONDS` / `COUNT`                    | `604800` / `5000` | Failed retention                |
| `BACKFILL_MAX_PAGES_PER_ENTITY`                               |            `1000` | Per-chain safety stop           |
| `BACKFILL_CLAIM_TIMEOUT_MS`                                   |          `900000` | Stale worker claim recovery     |
| `BACKFILL_RESUME_INTERVAL_MS`                                 |           `60000` | Pending cursor repair interval  |
| `WORKER_MAX_CONSECUTIVE_RATE_LIMITS`                          |               `8` | Infinite 429-loop guard         |
| `WORKER_METRICS_INTERVAL_MS`                                  |           `60000` | Structured diagnostics interval |
| `WORKER_SHUTDOWN_TIMEOUT_MS`                                  |           `30000` | Active-job drain timeout        |
| `DB_POOL_MAX`                                                 |              `10` | PostgreSQL pool ceiling         |
| `DB_IDLE_TIMEOUT_MS`                                          |           `30000` | Idle connection timeout         |
| `DB_CONNECTION_TIMEOUT_MS`                                    |            `5000` | Connection attempt timeout      |

`REDIS_URL` is preferred; `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`,
`REDIS_PASSWORD`, `REDIS_DB`, and `REDIS_TLS=true` are supported separately.
`LUOGU_COOKIE` and in-process Logtail transport are intentionally unsupported.
Logs go to stdout; the process manager or node-level agent owns rotation and
optional forwarding. Sentry is enabled only when `SENTRY_DSN` is set, never
sends default PII, and does not duplicate Pino logs.

## Repository settings that code cannot enforce

Configure the GitHub `main` branch/ruleset to require pull requests, at least
one approving review, the CI status check, and resolution of review comments.
Disable force pushes, deletions, direct pushes, and administrator bypass unless
there is a separately audited break-glass procedure. Store database, Redis,
Luogu, Sentry, and deployment credentials in GitHub Actions Secrets or the
runtime secret store, never ordinary repository Variables or build-time
`.env.local` files.

## Known residual risks

- Upstream Luogu response schemas can change. Runtime shape/size checks fail
  closed, but an upstream change can pause ingestion until the parser is updated.
- Redis/PostgreSQL availability remains a deployment dependency; queue and
  cursor recovery is idempotent but does not replace infrastructure backups.
- Historical bodies removed by the privacy apply step can still exist in older
  authorized backups. Backup retention and access controls remain an operator
  responsibility.
- There is intentionally no browser admin surface. Internal enqueue access is
  only as strong as production shell and process-account controls.
