# Deployment and Operations

## Required production environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Required. |
| `JWT_ACCESS_SECRET` | At least 32 characters. Required. |
| `JWT_REFRESH_SECRET` | At least 32 characters. Required. |
| `NODE_ENV` | `development`, `production`, or `test`. Required. |
| `JWT_ACCESS_SECRET_FALLBACKS` | Comma-separated previous access secrets for safe key rotation. Optional. |
| `JWT_REFRESH_SECRET_FALLBACKS` | Comma-separated previous refresh secrets. Optional. |

Optional production tuning (validated and range-checked at startup):

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3001` | Valid TCP port. |
| `JWT_ACCESS_EXPIRY` | `900` | Seconds. |
| `JWT_REFRESH_EXPIRY` | `604800` | Seconds. |
| `HOLD_TTL_SECONDS` | `600` | Hold expiry TTL, seconds. |
| `IDEMPOTENCY_TTL_SECONDS` | `86400` | Idempotency record expiry, seconds. |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowlist in production. |
| `RATE_LIMIT_WINDOW_MS` | `900000` | General limiter window. |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | General limiter limit. |
| `AUTH_RATE_LIMIT_MAX` | `5` | Login/register/refresh limit per minute per IP. |
| `BCRYPT_ROUNDS` | `12` | Must be between 4 and 31. |
| `LOG_LEVEL` | `info` | Pino level: fatal/error/warn/info/debug/trace/silent. |

Seed operation is refused unless `NODE_ENV=development` and `SEED_ENABLED=true` are both set.

## Containerized local deployment

`docker-compose.yml` starts PostgreSQL and a multi-stage image build. The `api`
service runs `prisma migrate deploy` before starting `node dist/server.js`
(migration-before-start). Compiled output and schema-generated client are baked
into the runtime stage; the runtime user is non-root.

```sh
docker compose up --build
```

## Rollback

Migrations are forward-only. To deploy an older application release, stop the
rolling update and re-run the previous immutable image; the schema must remain
backward compatible with the previous release until a coordinated schema
downgrade migration is executed. PostgreSQL does not automatically reverse
applied migrations.

## Backup and restore

- Back up with `pg_dump` against the production database; store encrypted
  snapshots off-box.
- Restore requires: stop booking traffic, create an empty database, run
  `prisma migrate deploy`, then load the dump into the schema baseline. Never
  restore over a live inventory database without a freeze.

## Scheduler ownership

Hold expiry and idempotency cleanup share a single advisory lock key derived
from a constant. Exactly one instance performs the combined maintenance cycle
per run; instances that lose the `pg_try_advisory_xact_lock` claim skip the
cycle and log a normal lock miss. Ownership releases automatically on commit,
rollback, or connection loss, so no manual unlock is needed.

## Readiness semantics

- `/health` is a liveness endpoint and returns `200 OK` whenever the process is
  up. It does not inspect the database.
- `/ready` executes a bounded `SELECT 1` query; it returns `503 Unavailable`
  when the database is not reachable or times out.
- `/metrics` exposes in-process counters and histograms. Restrict its exposure
  at the ingress in shared environments.

## Graceful shutdown

On `SIGTERM`/`SIGINT` the process stops scheduler registration, stops accepting
new requests, drains open HTTP connections within a bounded window, and
disconnects Prisma before exiting. A shutdown that does not complete within the
drain window exits after the timeout.