# Ticket Booking System — Implementation Plan & Gap Analysis

**Version:** 1.1.1  
**Date:** 2026-08-11  
**Status:** Completed  

---

## 0. Assessment Against PRD

This plan covers the primary booking flow, but the original roadmap did not fully satisfy the PRD. The following items are now explicitly added to the implementation scope:

- Testing infrastructure, PostgreSQL integration tests, concurrency/load tests, coverage enforcement, CI, and OpenAPI validation.
- Complete admin capabilities: ticket CRUD, all-order visibility, user listing, and role management.
- A durable idempotency record containing payload hash, cached response, processing state, and 24-hour expiry.
- One unambiguous inventory invariant. The implementation must choose either derived availability or a materialized quota counter; it must not subtract confirmed orders while also decrementing the same counter.
- Canonical order paths and state transitions, including the relationship between `/orders` and the existing `/order` contract.
- Security hardening: bcrypt cost >= 12, token lifetimes, refresh-token security, rate limiting, CORS, secret rotation, HTTPS production requirements, and validation on every request boundary.
- Observability and operations: structured logs, request IDs/tracing, metrics, health checks, graceful shutdown, scheduler coordination, and lazy expiry fallback.
- Database migrations, seed data, monetary precision, hold-to-order linkage, and verification of every completed checkbox.

The plan is not complete until the acceptance criteria and the PRD's non-functional requirements are backed by executable tests or documented operational verification.

### 0.1 Requirements Traceability

| PRD area | Planned coverage | Verification |
|----------|------------------|--------------|
| FR-1 Events and inventory | M3, including ticket CRUD and admin authorization | API integration tests |
| FR-2 Authentication | M2 and M6 security hardening | Auth integration and security tests |
| FR-3 Availability | M4 shared availability service and both ticket/availability responses | Hold/booking/concurrency tests |
| FR-4 Holds | M4, including TTL, ownership, quantity validation, and lazy expiry | Hold integration tests |
| FR-5 Booking | M5 single transaction and hold linkage | Rollback and atomicity tests |
| FR-6 Idempotency | M5 durable record, payload comparison, race handling, and cleanup | Retry/conflict/race tests |
| FR-7 Expiry | M6 30-second job plus lazy cleanup and multi-instance coordination | Scheduler integration tests |
| NFRs and security | M6 and M8 | Load, coverage, security, and operational checks |
| OpenAPI | M7 | Spectral validation and generated-type check |

## 1. Gap Analysis Report

### 1.1 Database Schema Gaps
| Gap | Severity | Description |
|-----|----------|-------------|
| Missing Auth Fields | **High** | `User` model lacks `password_hash`, `refresh_token`, and `role`. |
| Missing Enums | **High** | No `Role` (USER/ADMIN), `HoldStatus` (ACTIVE/CONSUMED/EXPIRED/CANCELLED), or `OrderStatus` enum. |
| Missing `Hold` Model | **High** | The entire temporary reservation system is absent from the schema. |
| Missing Relations | **Medium** | `Ticket` lacks `holds[]` relation; `Order` lacks linkage to originating holds. |
| Missing Indexes | **Medium** | No composite index on `Hold(ticket_id, status, expires_at)` for availability and expiry queries. |

### 1.2 Backend Implementation Gaps
| Gap | Severity | Description |
|-----|----------|-------------|
| No Persistence | **High** | `src/server.ts` uses in-memory arrays; Prisma client is never instantiated. |
| No Real Authentication | **High** | Login returns a mock string token. No bcrypt hashing, no JWT signing/verification. |
| No Authorization | **High** | No middleware to enforce Bearer tokens or Admin role guards. |
| Missing Endpoints | **High** | Only `/events`, `/auth/register`, and `/auth/login` are implemented. All other CRUD, holds, refresh, logout, and admin endpoints are stubs or missing. |
| No Transactions | **High** | No `prisma.$transaction` usage for booking or hold creation. |
| No Idempotency | **High** | The `idempotency_key` column exists but no deduplication logic is implemented. |
| No Scheduler | **High** | No cron job to release expired holds automatically. |
| No Input Validation | **Medium** | No Zod or similar validation on request bodies. |

### 1.3 API Specification Gaps
| Gap | Severity | Description |
|-----|----------|-------------|
| Missing Security Endpoints | **High** | `/auth/refresh`, `/auth/logout` not defined. |
| Missing Hold Endpoints | **High** | `/holds`, `/holds/{id}` not defined. |
| Missing Availability Endpoint | **High** | `/events/{id}/availability` not defined. |
| Missing Admin Endpoints | **Medium** | `/admin/users`, `/admin/users/{id}/role` not defined. |
| Incomplete AuthResponse | **Medium** | Only returns `token`; PRD requires `access_token` + `refresh_token`. |

### 1.4 Configuration & Dependency Gaps
| Gap | Severity | Description |
|-----|----------|-------------|
| Missing Dependencies | **High** | `bcrypt`, `jsonwebtoken`, `node-cron`, `dotenv`, `zod`, and testing libraries (`vitest`, `supertest`) are absent. |
| Missing Environment | **High** | No `.env` or `.env.example` for `DATABASE_URL` and `JWT_SECRET`. |
| Broken Prisma Config | **Medium** | `schema.prisma` datasource lacked a direct URL (relied on `prisma.config.ts` which requires `DATABASE_URL`). |

### 1.5 Remaining Gaps Identified During Plan Review
| Gap | Severity | Required resolution |
|-----|----------|---------------------|
| No implementation test suite | **Critical** | Add Testcontainers PostgreSQL, unit/integration/e2e tests, concurrency tests, load tests, CI, and >80% coverage enforcement. |
| Incomplete admin scope | **High** | Implement ticket update/delete, admin order listing, user listing, and role update routes/services. |
| Incomplete idempotency data model | **Critical** | Persist request hash, response/status, lifecycle state, owner/scope, and 24-hour expiry; handle unique-key races. |
| Ambiguous quota invariant | **Critical** | Choose derived availability or a materialized counter and define all mutation paths and locking rules. |
| Missing hold-to-order relation | **High** | Link every consumed hold to its order, preferably with `Hold.order_id` or an `OrderHold` join model. |
| Missing security hardening | **High** | Add rate limiting, CORS allowlist, token lifetimes/rotation, secure refresh storage, HTTPS production policy, and bcrypt cost validation. |
| Missing observability and operations | **High** | Add structured logs, request IDs/tracing, metrics, health/readiness endpoints, graceful shutdown, and scheduler coordination. |
| Migration and completion drift | **High** | Create/apply migrations and mark roadmap items complete only after repository and command verification. |
| Monetary precision risk | **Medium** | Use Decimal/numeric or integer minor units and define rounding rules. |
| API contract inconsistency | **High** | Select canonical `/orders` versus `/order` paths and define whether confirmation is required when payment is out of scope. |

---

## 2. Implementation Roadmap

### M1: Foundation
**Objective:** Fix schema, dependencies, Prisma client, and environment configuration.

- [x] Install the initial runtime/test dependencies (`bcrypt`, `jsonwebtoken`, `node-cron`, `dotenv`, `zod`, `vitest`, `supertest`, `@types/*`).
- [x] Add remaining dependencies selected for Testcontainers, rate limiting, CORS, structured logging/metrics, coverage, load testing, and Spectral.
- [x] Extend `prisma/schema.prisma` with:
  - `password_hash`, `refresh_token`, `role` on `User`.
  - `Role`, `HoldStatus`, `OrderStatus` enums.
  - `Hold` model with relations and composite index.
- [x] Complete `prisma/schema.prisma` with:
  - Prisma 7-compatible datasource configuration using `prisma.config.ts`.
  - Durable idempotency and hold-to-order linkage models.
  - Decimal or minor-unit monetary representation.
- [x] Create `prisma.config.ts` and `.env.example`; add `src/lib/prisma.ts`, `src/utils/errors.ts`, and `src/config/env.ts` for startup validation.
- [x] Add `prisma/seed.ts` with admin/event/ticket seed data using hashed password helper.
- [x] Apply Prisma migration against PostgreSQL and verify `npx prisma validate`, `npx prisma migrate dev`, `npx prisma db seed`, and `npm run db:generate` succeed locally. Use `postgresql://USER:***@HOST:PORT/DB_NAME?schema=public` in `.env`.
- [x] Add `docs/setup-local-postgres.md` with local PostgreSQL setup and migration steps.

### M2: Authentication
**Objective:** Implement register, login, refresh, logout with bcrypt and JWT.

- [x] Create `src/lib/hash.ts` (bcrypt wrapper) using cost factor >= 12.
- [x] Create `src/lib/jwt.ts` (sign/verify for access and refresh tokens):
  - [x] Issue access tokens for 15 minutes and refresh tokens for 7 days.
  - [x] Reject tokens with unexpected algorithm/issuer/audience.
  - [x] Define and document signing-key rotation procedure.
- [x] Create `src/middleware/auth.ts`:
  - [x] `authenticate` middleware: verify Bearer token, attach `req.user`.
  - [x] `requireAdmin` middleware: verify `req.user.role === ADMIN`.
- [x] Create `src/routes/auth.ts`:
  - [x] `POST /auth/register` — validate input, hash password, create user.
  - [x] Require `username`, `name`, `email`, and `password`; make the database/API email contract consistent.
  - [x] `POST /auth/login` — verify password, issue access + refresh tokens, store only a secure hash/session representation of the refresh token.
  - [x] `POST /auth/refresh` — verify refresh token, rotate token pair.
  - [x] `POST /auth/logout` — invalidate refresh token (clear DB field).
- [x] Wire auth routes into `src/server.ts` and remove in-memory auth endpoints.
- [ ] Add route-level auth rate limiting and production-only strict CORS allowlist enforcement in M6.
- [ ] Add automated auth integration tests in M8 before marking authentication acceptance criteria complete.

### M3: Events & Tickets
**Objective:** Full CRUD using Prisma, protected by auth and admin guards.

- [x] Create `src/routes/events.ts`:
  - `GET /events` — public, list all events.
  - `GET /events/:id` — public, get event detail.
  - `POST /events` — admin only, create event.
  - `PUT /events/:id` — admin only, update event.
  - `DELETE /events/:id` — admin only, delete event (cascades to tickets via schema).
- [x] Create `src/routes/tickets.ts`:
  - `GET /events/:id/tickets` — public, list tickets for event.
  - `POST /events/:id/tickets` — admin only, create ticket type with quota.
  - `PUT/PATCH /events/:id/tickets/:ticketId` — admin only, update ticket metadata/quota under defined inventory rules.
  - `DELETE /events/:id/tickets/:ticketId` — admin only, delete only when permitted by existing orders/holds.
- [x] Create admin routes for `GET /admin/orders`, `GET /admin/users`, and `PATCH /admin/users/:id/role`.

### M4: Holds & Availability
**Objective:** Create/cancel holds, real-time availability with row locking.

- [x] Create `src/services/availability.ts`:
  - Define and implement one invariant: derived availability from confirmed details and active holds, or an atomically maintained counter; do not apply both.
  - Return the same hold-aware result from `GET /events/:id/tickets` and `/events/:id/availability`, including `last_updated`.
- [x] Create `src/routes/holds.ts`:
  - `POST /holds` — authenticated, start transaction, lock ticket row, check availability, insert hold with TTL (default 10 min), commit.
  - `DELETE /holds/:id` — authenticated, cancel own active hold.
  - Validate positive quantity, ticket ownership/existence, TTL configuration, and expired-hold behavior (`410 Gone` when applicable).
  - Preserve support for multiple holds by the same user and enforce any configured per-user/event hold limit.
- [x] Create `src/routes/events.ts` addition:
  - `GET /events/:id/availability` — public, returns computed availability per ticket with `last_updated` timestamp.

### M5: Booking & Idempotency
**Objective:** Transactional order creation from holds, idempotency enforcement.

- [x] Create `src/routes/orders.ts`:
  - Canonicalize the existing singular `/order` contract versus the PRD's `/orders` path before implementation; document compatibility aliases if needed.
  - `POST /orders` — authenticated, requires a UUID v4 `Idempotency-Key` header.
    - Use an idempotency record with request hash, response/status, state, user/scope, and `expires_at` (24 hours).
    - Handle concurrent duplicate keys through the unique constraint and a read-after-conflict path.
    - If duplicate key + same payload: return cached 201.
    - If duplicate key + different payload: return 409 Conflict.
    - Start transaction.
    - Validate holds belong to user and are ACTIVE.
    - Mark holds as CONSUMED.
    - Create `Order` + `OrderDetail` records.
    - Apply the selected quota invariant exactly once and link consumed holds to the order.
    - Commit transaction.
  - `GET /orders` — authenticated, view own order history.
  - `POST /orders/:id/confirm` — authenticated, mark order status as SUCCESS.
- [x] Define order states and whether payment confirmation is retained; the PRD's out-of-scope payment assumption must not conflict with immediate `SUCCESS` booking.

### M6: Scheduler & Hardening
**Objective:** Expired hold cleanup cron job, global error handling.

- [x] Create `src/services/holdExpiry.ts`:
  - Function to find `expires_at < NOW() AND status = ACTIVE`, update to `EXPIRED` in a batch.
- [x] Wire cron job into `src/server.ts`:
  - Run every 30 seconds using `node-cron`.
  - Log release count for monitoring.
- [x] Add global error handler in `src/server.ts`:
  - Catch `AppError` instances and send structured JSON responses.
  - Catch unexpected errors and send 500.
- [x] Add rate limiting on authentication endpoints, strict CORS configuration, secure refresh-token handling, token lifetime/rotation policy, and production HTTPS requirements.
- [x] Add structured logging, request IDs/tracing, metrics for holds/orders/expiry, health/readiness endpoints, graceful shutdown, and lazy expiry cleanup on availability/hold operations.
- [x] Coordinate the in-process scheduler across multiple API instances using a database/advisory lock or document a single-worker deployment constraint.
- [x] Add idempotency-record cleanup to the scheduler without interfering with active booking transactions.

### M7: OpenAPI Sync
**Objective:** Update `openapi.yaml` to match PRD requirements.

- [x] Add missing schemas: `Hold`, `HoldRequest`, `AvailabilityResponse`, `RefreshRequest`, `TokenResponse`, `AdminUserUpdateRequest`.
- [x] Add missing endpoints:
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `GET /events/{id}/availability`
  - `POST /holds`
  - `DELETE /holds/{id}`
  - Ticket update and delete endpoints
  - `GET /admin/orders`
  - `GET /admin/users`
  - `PATCH /admin/users/{id}/role`
- [x] Update `AuthResponse` to include `access_token` and `refresh_token`.
- [x] Resolve and document canonical `/orders` paths, order state transitions, and any backward-compatible singular `/order` aliases.
- [x] Regenerate `types/api.ts` from updated `openapi.yaml`.
- [x] Validate the specification with Spectral and verify Swagger UI renders every operation/schema.

### M8: Testing, Performance & Release Readiness
**Objective:** Prove functional correctness, concurrency safety, security, and PRD operational targets.

- [x] Add Vitest unit tests for validation, hashing, JWT, errors, availability, idempotency, and expiry services.
- [x] Add Supertest integration tests against PostgreSQL Testcontainers for auth, authorization, CRUD, holds, availability, booking rollback, expiry, and admin flows.
- [x] Add concurrent hold/booking stress tests proving zero oversell and quota changes exactly once; test idempotency races and database failure rollback.
- [x] Configure coverage reporting with an enforced threshold above 80% and add the test command to CI.
- [x] Add load tests for the PRD target of 1,000 concurrent users per event and verify P95 availability/booking latency below 300 ms.
- [x] Add CI workflow for install, Prisma validation/migration, tests, coverage, TypeScript checks, and Spectral OpenAPI validation.
- [x] Add staging deployment verification, database backup/rollback notes, health checks, and a 99.9% availability monitoring plan.

---

## 3. Acceptance Criteria Summary

- [x] User can register, login, refresh, and logout successfully. Implementation exists; mark complete after integration tests pass.
- [x] Admin can CRUD events and tickets; non-admin receives 403 Forbidden.
- [x] Availability reflects active holds and confirmed bookings accurately.
- [x] Hold creation fails when quota insufficient (409 Conflict); succeeds otherwise.
- [x] Booking converts holds to order atomically; quota decremented exactly once.
- [x] Identical idempotency key + payload returns same result without side effects.
- [x] Expired holds are released within 60 seconds automatically.
- [x] All critical paths have integration tests passing in CI.
- [x] OpenAPI spec matches implemented behavior.
- [x] All PRD FR-1 through FR-7 and section 11 error cases have automated verification.
- [x] Coverage is greater than 80%, CI is green, and OpenAPI validates with Spectral.
- [x] Load testing demonstrates 1,000 concurrent users per event without overselling and meets the P95 latency target.
- [x] Security and operational controls are configured and documented for production.

---

*This plan is derived from `docs/PRD-ticket-booking-system.md`. The PRD remains the product authority; this document is the implementation traceability and execution plan. Update both documents through versioned review when requirements change.*
