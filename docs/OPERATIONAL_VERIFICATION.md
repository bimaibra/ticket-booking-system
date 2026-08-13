# Operational Verification & Load Testing Plan

## 1. Load Testing Overview

Target Performance:
- Concurrent Users: 1,000 active sessions per event
- P95 Latency Threshold: < 300 ms for `GET /events/:id/availability` and `POST /holds`
- Zero Oversell Guarantee: Quota invariant enforced at DB transaction level via derived availability calculation.

### K6 Load Script Example
To simulate 1,000 VUs against the ticket booking endpoints:

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

- **Health Checks**: Automated polling on `/health` every 10 seconds.
- **Alerting**: Alerting triggered if error rate exceeds 0.1% over a 5-minute window.
- **Metrics**: Track hold volume, expired hold count, order throughput, and idempotency cache hit rate via structured Pino logs and node-cron counters.
- **Scheduler Failover**: In multi-instance deployments, pin the node-cron scheduler to a single background worker process or employ a distributed lock strategy.
