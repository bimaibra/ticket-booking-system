# Operational Verification & Load Testing Plan

**Status:** Planned controls and release evidence; not current implementation claims.

## 1. Load Testing Overview

Target Performance:
- Concurrent Users: 1,000 active sessions per event
- P95 Latency Threshold: < 300 ms for `GET /events/:id/tickets`, `GET /events/:id/availability`, `POST /holds`, and `POST /orders`, reported per endpoint.
- Zero Oversell Release Criterion: Proven only after migration-backed contention tests and a post-run database invariant query show `active unexpired hold quantity + SUCCESS order quantity <= total_quota` for every ticket.

### Illustrative K6 Script

The snippet below exercises availability only. It is not release evidence. The release profile must use realistic authenticated users, create holds and orders under ticket contention, retain endpoint-specific latency/error summaries, and execute the invariant query after the run.

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 500 },
    { duration: '1m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
  },
};

export default function () {
  const res = http.get('http://localhost:3001/events/1/availability');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

## 2. Staging Deployment Verification

1. Provision PostgreSQL 16+ instance.
2. Set Environment Variables:
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET` (>= 32 chars)
   - `JWT_REFRESH_SECRET` (>= 32 chars)
   - `NODE_ENV=production`
   - `CORS_ORIGINS`
3. Execute `npx prisma migrate deploy`.
4. Run `npm run build` and start with `npm start`.
5. Verify `/health` endpoint returns `200 OK`.
6. Verify `/ready` returns `200 OK` only after a bounded database query succeeds.
7. Verify the compiled process emits structured request-ID-correlated logs and metrics.
8. Send SIGTERM and verify traffic draining, scheduler stop, Prisma disconnect, and bounded clean exit.

## 3. Database Backup & Rollback Procedures

### Daily Backup Script
```bash
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f "backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Point-in-Time Restore
```bash
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME --clean "backup_file.dump"
```

## 4. 99.9% Availability & Monitoring Plan

- **Health Checks**: `/health` is process liveness. `/ready` is readiness and performs a bounded database query. Deployment traffic is gated on readiness.
- **Alerting**: Alerting triggered if error rate exceeds 0.1% over a 5-minute window.
- **Structured Logging (planned)**: Pino request logs propagate or generate request IDs and redact credentials, tokens, idempotency payloads, and personal data. The current runtime still uses `console.*` until Phase 6 is complete.
- **Metrics (planned)**: Counters and histograms cover hold/booking/idempotency outcomes, expiry and cleanup counts, lock misses, request duration, scheduler duration, and database errors. These metrics are not implemented yet.
- **Scheduler Ownership (planned)**: Every instance may attempt the 30-second cycle. It opens one transaction and calls nonblocking `pg_try_advisory_xact_lock(0x5449434B4554434C)`. A false result performs no maintenance and records a lock miss. The winner captures database time once, processes bounded expired-hold batches followed by expired-idempotency cleanup through the same transaction client, and commits atomically before a 25-second deadline. Transaction ownership is released automatically on commit, rollback, or connection loss.
