# Ticket Booking System — Product Requirements Document (PRD)

**Version:** 1.0.0  
**Date:** 2026-08-04  
**Status:** Draft  

---

## 1. Project Overview & Objectives

### 1.1 Vision
Build a reliable, scalable ticket booking system that allows users to discover events, check real-time seat/ticket availability, temporarily reserve seats, and complete bookings with strong consistency guarantees.

### 1.2 Business Objectives
- Enable event organizers to manage events and ticket inventory.
- Allow end-users to browse events, hold seats temporarily, and confirm bookings atomically.
- Prevent overselling through concurrency-safe quota management.
- Provide idempotent booking APIs to handle network retries safely.
- Automatically release expired holds to maximize inventory utilization.

### 1.3 Success Metrics
- Zero oversell incidents under concurrent load.
- P95 API latency < 300ms for availability checks and booking creation.
- Expired holds released within 60 seconds of expiration.
- Idempotency key prevents duplicate bookings in 100% of retry scenarios.

---

## 2. Current System Analysis

### 2.1 Existing Artifacts
| Artifact | Status | Notes |
|----------|--------|-------|
| `package.json` | Scaffolded | Express 5, Prisma Client 7.9.1, Swagger UI, yamljs. No test framework configured. |
| `tsconfig.json` | Configured | Strict mode, ESM (`nodenext`), target ESNext. |
| `prisma/schema.prisma` | Defined | Models: User, Event, Ticket, Order, OrderDetail. PostgreSQL provider. Migration exists but DB not wired. |
| `openapi.yaml` | Partial | Covers auth, events, tickets, orders. Missing refresh token, logout, hold endpoints. |
| `src/server.ts` | Prototype only | In-memory mock data, no Prisma client, no JWT, no transactions, no concurrency control. |
| Tests | None | `npm run test` returns "no test specified". |
| `.env` / DB URL | Missing | `prisma validate` fails due to missing `dotenv/config`. |

### 2.2 Identified Gaps
1. **No persistence layer** — Prisma schema exists but is unused; server uses in-memory arrays.
2. **No authentication** — Login returns mock tokens; no hashing, no JWT signing/verification, no refresh/logout.
3. **No authorization** — No role-based access control; any user can create/edit/delete events.
4. **No real-time availability** — No mechanism to reflect concurrent holds or bookings on quota.
5. **No temporary seat hold** — No concept of time-limited reservations before payment.
6. **No transactional booking** — Order creation is not atomic; no rollback on failure.
7. **No idempotency enforcement** — Schema has `idempotency_key` field but no dedup logic.
8. **No expired hold scheduler** — No cron/worker to release stale holds.
9. **No testing infrastructure** — No unit, integration, or e2e tests.
10. **OpenAPI spec incomplete** — Missing endpoints for holds, refresh, logout, admin operations.

---

## 3. Proposed Solution Architecture

### 3.1 Tech Stack
- **Runtime:** Node.js (ESM) + TypeScript
- **Framework:** Express 5
- **ORM:** Prisma 7.x with PostgreSQL
- **Auth:** JWT (access + refresh tokens), bcrypt
- **Concurrency:** PostgreSQL row-level locking + optimistic versioning
- **Scheduler:** node-cron or BullMQ for expired hold cleanup
- **Real-time (optional):** Server-Sent Events or WebSocket for live availability push
- **Testing:** Vitest + Supertest + Testcontainers (PostgreSQL)
- **Docs:** OpenAPI 3.1 + Swagger UI

### 3.2 High-Level Architecture
```
[Client] → [Express API] → [Prisma ORM] → [PostgreSQL]
                ↓
        [JWT Middleware]
                ↓
     [Hold Expiry Scheduler]
```

---

## 4. User Roles & Permissions

| Role | Capabilities |
|------|-------------|
| Guest | Browse events, view ticket availability |
| Registered User | All Guest capabilities + register/login/logout/refresh, create holds, place orders, view own order history |
| Admin | All User capabilities + CRUD events, CRUD tickets, view all orders, manage users |

---

## 5. Functional Requirements

### FR-1: Event Management & Inventory
- **FR-1.1:** Admin can create, read, update, delete events.
- **FR-1.2:** Each event has: name, date, description, address, timestamps.
- **FR-1.3:** Admin can define multiple ticket types per event (e.g., VIP, General).
- **FR-1.4:** Each ticket type has: name, total_quota, available_quota, price.
- **FR-1.5:** Deleting an event cascades to its tickets (already defined in schema via `onDelete: Cascade`).

### FR-2: User Authentication
- **FR-2.1:** Register with username, name, email, password. Password stored as bcrypt hash.
- **FR-2.2:** Login returns short-lived access token (15min) + long-lived refresh token (7d).
- **FR-2.3:** Refresh endpoint accepts valid refresh token, returns new token pair.
- **FR-2.4:** Logout invalidates refresh token (stored in DB or blocklist).
- **FR-2.5:** Protected routes require valid access token in `Authorization: Bearer <token>` header.

### FR-3: Real-Time Availability Checking
- **FR-3.1:** GET `/events/{id}/tickets` returns current `available_quota` reflecting active holds and confirmed bookings.
- **FR-3.2:** Available quota = total_quota - SUM(confirmed_order_details.quantity) - SUM(active_holds.quantity).
- **FR-3.3:** Response includes `last_updated` timestamp for client-side caching/validation.

### FR-4: Temporary Seat Hold
- **FR-4.1:** Authenticated user can POST `/holds` with `{ticket_id, quantity}`.
- **FR-4.2:** Hold reserves seats for configurable TTL (default 10 minutes).
- **FR-4.3:** Hold creation fails atomically if insufficient available quota.
- **FR-4.4:** Hold response includes `hold_id`, `expires_at`, and locked quantity.
- **FR-4.5:** Multiple holds by same user on same ticket are allowed but count against quota.

### FR-5: Booking Confirmation
- **FR-5.1:** POST `/orders` converts one or more active holds into a confirmed order.
- **FR-5.2:** Entire operation runs inside a single database transaction.
- **FR-5.3:** On success: holds are marked consumed, order status = SUCCESS, quotas permanently decremented.
- **FR-5.4:** On failure: transaction rolls back; holds remain active until expiry.
- **FR-5.5:** Order includes `total_amount`, `status`, `expired_at` (for payment deadline if applicable).

### FR-6: Idempotency Key
- **FR-6.1:** POST `/orders` requires `Idempotency-Key` header (UUID v4).
- **FR-6.2:** If key already exists with matching payload, return cached response without reprocessing.
- **FR-6.3:** If key exists with different payload, return 409 Conflict.
- **FR-6.4:** Keys expire after 24 hours (cleanup via scheduler or TTL index).

### FR-7: Expired Hold Scheduler
- **FR-7.1:** Background job runs every 30 seconds.
- **FR-7.2:** Finds holds where `expires_at < NOW()` and status = ACTIVE.
- **FR-7.3:** Marks them as EXPIRED and releases quota atomically.
- **FR-7.4:** Logs release count for monitoring.

---

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|------------|
| Performance | P95 latency < 300ms for availability & booking APIs |
| Scalability | Support 1,000 concurrent users per event without degradation |
| Availability | 99.9% uptime during business hours |
| Security | OWASP Top 10 compliant; secrets in env vars only; HTTPS in production |
| Data Integrity | ACID transactions for all quota mutations |
| Observability | Structured logging, request tracing, metrics for holds/orders/expiries |
| Testing | >80% code coverage; integration tests for all critical paths |

---

## 7. Database Design

### 7.1 Enhanced Schema Additions
```prisma
model User {
  // existing fields...
  password_hash String
  refresh_token String?
  role          Role      @default(USER)
}

enum Role {
  USER
  ADMIN
}

model Hold {
  id         Int      @id @default(autoincrement())
  user_id    Int
  ticket_id  Int
  quantity   Int
  expires_at DateTime
  status     HoldStatus @default(ACTIVE)
  created_at DateTime @default(now())

  user   User   @relation(fields: [user_id], references: [id])
  ticket Ticket @relation(fields: [ticket_id], references: [id])
}

enum HoldStatus {
  ACTIVE
  CONSUMED
  EXPIRED
  CANCELLED
}

// Add to Ticket model:
// holds Hold[]

// Add to Order model:
// hold_id Int?  // optional link to originating hold
```

### 7.2 Key Indexes
- `Hold(ticket_id, status, expires_at)` — for availability calc and expiry job
- `Order(idempotency_key)` — unique constraint (already exists)
- `Ticket(event_id)` — for fast event-ticket lookups

---

## 8. API Specification (Additions to Existing OpenAPI)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/refresh` | No | Refresh access token |
| POST | `/auth/logout` | Yes | Invalidate refresh token |
| GET | `/events/{id}/availability` | No | Real-time quota with hold-aware calculation |
| POST | `/holds` | Yes | Create temporary seat hold |
| DELETE | `/holds/{id}` | Yes | Cancel active hold |
| POST | `/orders` | Yes | Confirm booking from holds (idempotent) |
| GET | `/admin/users` | Admin | List all users |
| PATCH | `/admin/users/{id}/role` | Admin | Update user role |

*All existing endpoints in `openapi.yaml` remain valid but require implementation against Prisma instead of in-memory store.*

---

## 9. Booking Workflow Sequence Diagram

```
User          API             DB              Scheduler
 |             |               |                  |
 |--POST /holds-->|            |                  |
 |             |--TX BEGIN---->|                  |
 |             |--Check quota->|                  |
 |             |--INSERT Hold->|                  |
 |             |--TX COMMIT--->|                  |
 |<--hold_id----|               |                  |
 |             |               |                  |
 |--POST /orders+IdemKey-->|   |                  |
 |             |--Lookup key-->|                  |
 |             |--TX BEGIN---->|                  |
 |             |--Validate holds->|               |
 |             |--Create Order+Details->|          |
 |             |--Mark holds CONSUMED->|           |
 |             |--Decrement quota->|               |
 |             |--Store idem key->|                |
 |             |--TX COMMIT--->|                  |
 |<--Order------|               |                  |
 |             |               |                  |
 |             |               |<--Every 30s------|
 |             |               |--Release expired->|
```

---

## 10. Concurrency Handling Strategy

1. **Quota Check + Hold Creation:** Use `SELECT ... FOR UPDATE` on Ticket row within transaction to prevent race conditions.
2. **Booking Confirmation:** Same row lock on Ticket + atomic UPDATE of `available_quota`.
3. **Idempotency:** Unique constraint on `idempotency_key` acts as final safety net; application-level check avoids unnecessary work.
4. **Hold Expiry:** Scheduler uses batch UPDATE with WHERE `expires_at < NOW() AND status = 'ACTIVE'` to avoid locking contention.

---

## 11. Error Handling & Edge Cases

| Scenario | Behavior |
|----------|----------|
| Insufficient quota during hold | Return 409 Conflict with current available count |
| Hold expired before booking | Return 410 Gone; client must re-hold |
| Duplicate idempotency key, same payload | Return cached 201 response |
| Duplicate idempotency key, different payload | Return 409 Conflict |
| Concurrent booking attempts exceeding quota | Second transaction fails quota check, returns 409 |
| DB connection loss during transaction | Transaction auto-rolls back; client retries with same idempotency key |
| Invalid/expired JWT | Return 401 Unauthorized |
| Admin-only route accessed by regular user | Return 403 Forbidden |

---

## 12. Security Considerations

- Passwords hashed with bcrypt (cost factor ≥ 12).
- JWT signed with RS256 or HS256 + secret rotation.
- Refresh tokens stored securely (httpOnly cookie or secure storage).
- Rate limiting on auth endpoints (max 5 login attempts/min/IP).
- Input validation via Zod/OpenAPI middleware.
- CORS configured for known origins only.
- SQL injection prevented by Prisma parameterized queries.
- Secrets never logged or committed (.env in .gitignore ✓).

---

## 13. Assumptions, Constraints & Risks

### Assumptions
- PostgreSQL 15+ is available for development and production.
- Single-region deployment initially; no multi-region sync needed.
- Payment processing is out of scope; booking confirmation assumes payment succeeded externally.

### Constraints
- Must use existing Prisma schema as baseline (extend, don't rewrite).
- Must maintain backward compatibility with existing OpenAPI contract where possible.
- No external message queue initially; scheduler runs in-process.

### Risks
| Risk | Mitigation |
|------|-----------|
| Oversell under extreme concurrency | Row-level locking + integration stress tests |
| Hold starvation (users hoarding holds) | Max holds per user per event; shorter TTL |
| Scheduler downtime causing stale holds | Fallback: lazy cleanup on next availability check |
| JWT secret compromise | Secret rotation plan + short token lifetime |

---

## 14. Milestones & Implementation Roadmap

| Phase | Deliverables | Duration |
|-------|-------------|----------|
| M1: Foundation | Wire Prisma to DB, add migrations, setup test infra, implement User model + bcrypt | 1 week |
| M2: Auth | JWT access/refresh, login/register/logout/refresh endpoints, auth middleware | 1 week |
| M3: Events & Tickets | Full CRUD for events/tickets using Prisma, admin role enforcement | 1 week |
| M4: Holds & Availability | Hold model, POST/DELETE holds, real-time availability endpoint | 1.5 weeks |
| M5: Booking & Idempotency | Transactional order creation, idempotency enforcement, order history | 1.5 weeks |
| M6: Scheduler & Hardening | Expired hold job, rate limiting, input validation, security audit | 1 week |
| M7: Testing & Docs | Integration tests, load tests, finalize OpenAPI, deploy staging | 1 week |

**Total Estimated Timeline:** 8 weeks

---

## 15. Acceptance Criteria Summary

- [ ] User can register, login, refresh, and logout successfully.
- [ ] Admin can CRUD events and tickets; non-admin cannot.
- [ ] Availability reflects active holds and confirmed bookings accurately.
- [ ] Hold creation fails when quota insufficient; succeeds otherwise.
- [ ] Booking converts holds to order atomically; quota decremented exactly once.
- [ ] Identical idempotency key + payload returns same result without side effects.
- [ ] Expired holds are released within 60 seconds automatically.
- [ ] All critical paths have integration tests passing in CI.
- [ ] OpenAPI spec matches implemented behavior and validates via spectral.

---

*This document is the single source of truth for the Ticket Booking System. All design, implementation, and testing decisions should align with this PRD. Updates require version bump and team review.*

</parameter>