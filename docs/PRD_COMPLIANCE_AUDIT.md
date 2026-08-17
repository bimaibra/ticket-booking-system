# Ticket Booking System PRD Compliance Audit

**Audit date:** 2026-08-14  
**PRD:** `docs/PRD-ticket-booking-system.md` version 1.0.0  
**Assessment:** Not yet aligned; release blockers remain  
**Scope:** Read-only architecture, implementation, API, database, security, testing, and operations review

## 1. Executive Summary

The project is not yet fully aligned with the PRD and is not production-ready for ticket inventory. The Express, Prisma, authentication, hold, order, scheduler, test, and OpenAPI foundations exist, but the PRD's central guarantees, particularly zero overselling and exactly-once booking, are not currently enforced.

The most important issues are:

1. Availability subtracts hold and order-detail row counts instead of their quantities.
2. Hold creation does not lock inventory and reads availability outside its transaction client.
3. The same hold can be converted into multiple orders concurrently.
4. Concurrent retries using the same idempotency key are not safely coordinated.
5. Idempotency-record expiry conflicts with the permanent unique key stored on orders.
6. Ticket routes are mounted at paths that do not match the PRD or OpenAPI specification.

These defects prevent compliance with the following core objectives:

- Zero oversell incidents under concurrent load.
- Strong consistency for holds and bookings.
- Atomic hold-to-order conversion.
- Duplicate-booking prevention in 100% of retry scenarios.
- Accurate real-time availability.

No project files were modified during the analysis that produced this report.

## 2. MCP Skill Stack

The analysis covered all ten project capability dimensions and used a validated stack from the `agentic-awesome-skills` MCP catalog.

**Catalog:** `agentic-awesome-skills` 15.12.0  
**Catalog integrity:** `sha256-2dd08dd4475678c6fd75c28bb27a40958a8b2b99d4771bf0c079e311ece41ad4`  
**Manifest digest:** `sha256-3d5554086f1e31a77964d179bb7732f02a6a7a5688e4f79a931bfd5222479ea9`

Selected skills:

- `architecture`
- `backend-dev-guidelines`
- `backend-architect`
- `postgresql`
- `auth-implementation-patterns`
- `openapi-spec-generation`
- `javascript-testing-patterns`
- `brooks-test`
- `api-security-best-practices`
- `api-and-interface-design`
- `application-performance-performance-optimization`
- `ci-cd-and-automation`
- `error-debugging-error-trace`
- `codebase-audit-pre-push`

## 3. Release Blockers

### 3.1 Availability Ignores Ticket Quantities

**Severity:** Critical  
**PRD references:** FR-3.1, FR-3.2, FR-4.3, FR-5.3; zero-oversell success metric; Data Integrity NFR

`src/services/availability.ts:16-38` selects identifiers and subtracts `orderDetails.length` and `holds.length`. A hold or order detail for ten tickets therefore consumes only one unit in reported availability.

The query also counts order details without filtering the parent order to `SUCCESS`.

**Impact:**

- Availability can be substantially overstated.
- Hold creation can accept quantities beyond inventory.
- The system can oversell even without concurrent requests.
- Pending, cancelled, or expired orders can incorrectly consume inventory.

**Required correction:**

- Sum `Hold.quantity` for active, unexpired holds.
- Sum `OrderDetail.quantity` only for confirmed or `SUCCESS` orders.
- Perform aggregation in PostgreSQL or through transaction-scoped aggregate queries.
- Add quantity-aware tests with quantities greater than one.

### 3.2 Hold Creation Is Not Concurrency-Safe

**Severity:** Critical  
**PRD references:** FR-4.3; section 10 item 1; zero-oversell success metric; Data Integrity NFR

`src/routes/holds.ts:30-58` starts a transaction but does not lock the ticket row. It uses an ordinary `findUnique` at lines 31-36.

The availability call at `src/routes/holds.ts:42` invokes a service that uses the global Prisma client from `src/services/availability.ts:1`, rather than transaction client `tx`.

**Impact:**

Concurrent hold requests can observe the same available inventory and all insert holds successfully.

**Required correction:**

- Lock the ticket row with PostgreSQL `SELECT ... FOR UPDATE`, or use an equivalent atomic reservation mechanism.
- Run all reads and mutations through the same transaction client.
- Lock rows in a deterministic order when multiple tickets are involved.
- Verify the final database invariant after repeated contention tests.

### 3.3 One Hold Can Produce Multiple Orders

**Severity:** Critical  
**PRD references:** FR-5.1 through FR-5.4; section 10 item 2; exact-once booking acceptance criterion

`src/routes/orders.ts:64-79` reads an ACTIVE hold without locking it. The route creates an order at lines 91-110 and only then unconditionally updates the hold at lines 112-115.

`Hold.order_id` is nullable and not unique at `prisma/schema.prisma:71-73`.

**Impact:**

Two requests using different idempotency keys can both read the same hold as ACTIVE, create separate successful orders, and then overwrite the hold's `order_id` link.

**Required correction:**

- Lock the selected hold and ticket rows before order creation, or atomically claim the hold with `WHERE status = 'ACTIVE' AND expires_at > NOW()`.
- Require exactly one successful ACTIVE-to-CONSUMED transition per hold.
- Add a database-level one-consumption constraint or an explicit order-hold join design.
- Test simultaneous booking attempts against the same hold.

### 3.4 Concurrent Idempotent Retries Are Not Coordinated

**Severity:** Critical  
**PRD references:** FR-6.2, FR-6.3; section 10 item 3; 100% retry-safety success metric

The key lookup occurs outside the booking transaction at `src/routes/orders.ts:41-61`. The idempotency record is written only after order creation at lines 119-144.

The schema describes PENDING and COMPLETED states, but the route creates only a final COMPLETED record.

**Impact:**

Simultaneous requests can both observe no record and begin processing. A losing request can receive an unhandled uniqueness error instead of the required cached response.

**Required correction:**

- Atomically claim the key with a PENDING record before business processing.
- Store the payload hash, scope, owner, and expiry as part of the claim.
- Resolve unique-constraint races by reading the winning record.
- Define behavior for requests that encounter an in-progress matching operation.
- Test same-key/same-payload and same-key/different-payload races.

### 3.5 Idempotency Expiry Conflicts With Permanent Order Uniqueness

**Severity:** Critical  
**PRD reference:** FR-6.4

`Order.idempotency_key` is permanently unique at `prisma/schema.prisma:101-102`. The scheduler deletes expired `IdempotencyRecord` rows, but it does not remove the key from existing orders.

The preflight lookup at `src/routes/orders.ts:50-60` also uses an existing record without checking `expires_at`.

**Impact:**

After the idempotency record expires, reuse of the key can fail against the old order's unique constraint rather than behave as an expired key.

**Required correction:**

- Choose one canonical idempotency store.
- Remove permanent order-level uniqueness if keys are intended to expire, or explicitly manage the order key lifecycle.
- Reject or ignore expired records immediately rather than waiting for scheduled cleanup.

### 3.6 Ticket Routes Do Not Match the Documented Paths

**Severity:** Critical  
**PRD references:** FR-1.3, FR-1.4, FR-3.1; API backward-compatibility constraint

`src/server.ts:38` mounts `ticketsRouter` under `/events`, while route paths in `src/routes/tickets.ts:22-127` already begin with `/events`.

The resulting runtime paths are:

- `/events/events/:eventId/tickets`
- `/events/events/:eventId/tickets/:ticketId`

The PRD and OpenAPI specify `/events/:eventId/tickets`.

**Required correction:**

- Mount `ticketsRouter` at `/`, or remove `/events` from the paths declared inside the router.
- Add contract tests against the exact OpenAPI paths.

## 4. High-Priority Gaps

### 4.1 Ticket Listing Does Not Return Availability

**PRD references:** FR-3.1, FR-3.2, FR-3.3

`src/routes/tickets.ts:33-38` returns raw ticket rows. It does not include hold-aware `available_quota` or `last_updated`.

The separate `/events/{id}/availability` endpoint does not resolve the literal FR-3.1 requirement for `/events/{id}/tickets`.

### 4.2 Booking Supports Only One Hold

**PRD reference:** FR-5.1

`src/routes/orders.ts:12-14` accepts a single `hold_id`. The route loads one hold and creates one order detail.

The PRD requires conversion of one or more active holds in one atomic order.

### 4.3 Idempotency Key Is Not UUID v4

**PRD reference:** FR-6.1

`src/routes/orders.ts:28-31` checks only that the header exists and is a string. OpenAPI also lacks a UUID constraint.

### 4.4 Configured Idempotency TTL Is Ignored

**PRD reference:** FR-6.4

The route hard-codes 24 hours at `src/routes/orders.ts:132,142` rather than using `IDEMPOTENCY_TTL_SECONDS` from the validated environment configuration.

### 4.5 Expired Holds Return the Wrong Status

**PRD reference:** Section 11, expired hold behavior

`src/routes/orders.ts:81-87` throws `ValidationError`, which maps to HTTP 400 rather than the required 410 Gone.

The route updates the hold to EXPIRED and then throws inside the same transaction, so the update is rolled back.

### 4.6 Quota Can Be Reduced Below Existing Allocations

**PRD references:** FR-1.4, FR-3.2, FR-4.3; Data Integrity NFR

`src/routes/tickets.ts:88-93` and `src/routes/tickets.ts:116-121` allow direct quota updates without checking active holds or successful orders.

Clamping reported availability to zero hides the broken invariant rather than preventing it.

### 4.7 Database Constraints Are Incomplete

**PRD reference:** Data Integrity NFR

The migration has no database `CHECK` constraints for:

- Positive ticket quota.
- Positive hold and order-detail quantities.
- Nonnegative prices and subtotals.
- Valid idempotency lifecycle states.

Application validation alone does not protect direct database writes, scripts, migrations, or future routes.

### 4.8 Order Response Does Not Match OpenAPI

**PRD reference:** OpenAPI acceptance criterion

Runtime returns `{ order, hold_id }` at `src/routes/orders.ts:117-149`. `openapi.yaml:903-909` describes a bare `Order` response.

### 4.9 Event Deletion Can Fail Unexpectedly

**PRD references:** FR-1.1, FR-1.5

Event deletion cascades to tickets, but hold and order-detail foreign keys restrict ticket deletion. An event with booking history can therefore produce an unhandled database error rather than a defined conflict response.

### 4.10 Authentication Rate Limiting Is Missing

**PRD reference:** Section 12, maximum five login attempts per minute per IP

`express-rate-limit` is installed and environment settings exist, but no rate limiter is mounted on authentication routes.

### 4.11 Seed Credentials Are Predictable

**PRD reference:** Security NFR and section 12

The seed script creates predictable administrator and user credentials. If used outside an isolated development environment, this creates an immediate account-compromise risk.

### 4.12 Observability Requirements Are Not Implemented

**PRD references:** Observability NFR, FR-7.4

`src/server.ts:47-82` uses console logging. Pino is installed but unused. The project has no request IDs, trace correlation, application metrics, or readiness endpoint.

### 4.13 Runtime Operations Are Incomplete

**PRD references:** Availability NFR, deployment roadmap, scheduler requirements

The repository does not provide:

- Graceful shutdown handling.
- A database-aware readiness endpoint.
- A deployable container or service definition.
- A staging deployment workflow.
- Enforceable single-scheduler ownership or a distributed scheduler lock.
- Automated migration deployment as part of release verification.

### 4.14 Availability Query Will Not Scale Well

**PRD references:** P95 performance NFR, 1,000-user scalability NFR

The availability service materializes matching hold and order-detail rows instead of aggregating quantities in PostgreSQL. `OrderDetail(ticket_id)` also lacks an explicit index.

## 5. Testing and Documentation Findings

### 5.1 Integration Tests Do Not Apply the Real Migration

The integration suites create tables manually instead of running `prisma migrate deploy`. Their schema differs from production enums, indexes, foreign keys, and deletion behavior.

Passing those tests would not prove that the checked-in migration can initialize or support the application.

### 5.2 Test Database Initialization Is Unreliable

Application routes import the global Prisma singleton before Testcontainers assigns its runtime connection URL. HTTP requests and test cleanup can consequently use different databases.

### 5.3 Critical Concurrency Cases Are Missing

The test suite does not cover:

- Concurrent booking of the same hold with different keys.
- Concurrent requests with the same idempotency key.
- Same-key/different-payload races.
- Hold cancellation racing with booking.
- Hold expiry racing with booking.
- Multi-hold atomic booking.
- Transaction rollback after an injected database failure.

### 5.4 Load Verification Is Not Representative

The Vitest load test mocks both Prisma and the availability service. It does not measure PostgreSQL behavior, network latency, P95 latency, or 1,000 active users.

A k6 script exists but covers only availability and is not run through a package script or CI.

### 5.5 Coverage Configuration Does Not Meet the Literal Requirement

`vitest.config.ts:17-22` configures:

- Lines: 80%
- Functions: 80%
- Statements: 80%
- Branches: 75%

The PRD requires greater than 80% coverage. The production server entrypoint is also excluded from coverage.

### 5.6 CI Does Not Verify Deployment Readiness

`.github/workflows/ci.yml:39-41` runs Prisma commands without assigning `DATABASE_URL` to those steps. The workflow also does not:

- Apply the committed migration.
- Run `npm run build`.
- Start the compiled application.
- Execute a health or readiness smoke test.
- Run k6.
- Produce or deploy a staging artifact.

### 5.7 Implementation Status Is Overstated

`docs/IMPLEMENTATION_PLAN.md:222-246` marks critical paths, zero oversell, observability, load testing, and release readiness complete. Those claims are not supported by the current implementation or executable verification.

`docs/OPERATIONAL_VERIFICATION.md:64` also claims structured Pino logs and counters that do not exist in runtime code.

## 6. Implemented Strengths

The repository has a useful foundation:

- Express 5, TypeScript ESM, Prisma 7, PostgreSQL, Zod, JWT, bcrypt, node-cron, Vitest, Supertest, Testcontainers, and OpenAPI 3.1 are wired.
- Passwords are hashed with bcrypt and a minimum cost factor of 12 is enforced.
- Access and refresh JWTs use separate secrets and validate algorithm, issuer, audience, and token type.
- Default access and refresh lifetimes match the PRD.
- Refresh-token hashes are stored in the database and logout invalidates the stored token.
- Admin middleware protects event, ticket, order, user, and role-management routes.
- Hold, order, order-detail, and durable idempotency models exist.
- Required hold expiry and ticket event indexes exist.
- Ordinary single-hold order side effects are grouped in a Prisma transaction.
- Monetary values use Prisma Decimal rather than floating-point arithmetic.
- The expiry scheduler runs every 30 seconds and performs a conditional batch update.
- OpenAPI 3.1 includes the major authentication, hold, availability, order, and admin paths.
- TypeScript compilation, production build, and Spectral lint pass.

These strengths provide a good structural base, but they do not compensate for the unresolved inventory and concurrency defects.

## 7. Verification Results

The following commands were executed during the audit:

| Command | Result |
|---------|--------|
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `npm run openapi:lint` | Passed |
| `npm test` | Partial failure |

For `npm test`:

- 16 tests passed.
- Four non-integration suites passed.
- Both integration suites failed before their test cases ran.
- Failure reason: no working Docker/Testcontainers runtime was available.

This is an environment blocker rather than direct proof of an application defect, but it means critical integration behavior was not verified locally.

## 8. PRD Ambiguities Requiring Resolution

### 8.1 Derived Versus Materialized Availability

The PRD simultaneously describes:

- A stored `available_quota` ticket field.
- Availability derived from successful order quantities and active hold quantities.
- Permanent quota decrement during booking.
- Quota release during hold expiry.

The product and engineering design should choose one invariant:

1. A materialized counter updated atomically on every mutation; or
2. Derived availability calculated from authoritative hold and order rows under an appropriate locking strategy.

The two approaches must not be combined in a way that double-counts inventory changes.

### 8.2 Singular Versus Multiple Holds

FR-5.1 requires one or more active holds, while the current OpenAPI and implementation use one `hold_id`.

The contract should explicitly choose `hold_id` or a non-empty, unique `hold_ids` array.

### 8.3 Ticket Listing Versus Availability Endpoint

FR-3.1 says `/events/{id}/tickets` returns current availability, while section 8 also defines `/events/{id}/availability`.

The PRD should state whether both endpoints return availability or whether the dedicated availability endpoint is canonical.

### 8.4 Immediate Success Versus Payment Confirmation

FR-5.3 says order creation produces `SUCCESS`, and payment processing is out of scope. The API nevertheless retains `/orders/{id}/confirm`, which expects a `PENDING` order even though the main workflow creates no such order.

The lifecycle should choose immediate confirmation or a two-stage pending/payment-confirmation model.

## 9. Recommended Remediation Order

1. Correct quantity-based availability and filter only successful orders.
2. Implement transaction-scoped PostgreSQL locking or an equivalent atomic reservation mechanism.
3. Guarantee one-time hold consumption at application and database levels.
4. Implement an atomic PENDING idempotency claim and read-after-conflict behavior.
5. Reconcile expiring idempotency keys with `Order.idempotency_key` uniqueness.
6. Fix ticket router mounting and availability response contracts.
7. Add multi-hold atomic booking if FR-5.1 remains authoritative.
8. Replace synthetic integration DDL with the actual Prisma migration.
9. Inject the test database before loading application modules or refactor the application to support dependency injection.
10. Add repeated concurrency tests for holds, same-hold booking, idempotency, cancellation, and expiry.
11. Add rate limiting, structured observability, readiness, graceful shutdown, and scheduler coordination.
12. Add database constraints and safe quota-update rules.
13. Add real database-backed load tests for availability and booking and retain benchmark evidence.
14. Correct `docs/IMPLEMENTATION_PLAN.md` so only evidence-backed requirements are marked complete.

## 10. Release Gate Recommendation

The system should not be approved for production inventory until all of the following are demonstrated against the actual PostgreSQL migration:

- Quantity-correct availability.
- No overselling under repeated concurrent hold attempts.
- Exactly one order from one hold under concurrent booking attempts.
- Deterministic concurrent idempotency behavior.
- Successful multi-hold atomicity if retained in the PRD.
- Expired holds handled within the required time and with the required API status.
- OpenAPI contract tests passing against runtime routes and response bodies.
- Critical integration tests and coverage passing in CI.
- Database-backed P95 load results meeting the PRD target.
- Production rate limiting, observability, readiness, shutdown, and scheduler ownership controls.

Until those gates pass, the implementation should be described as a functional foundation rather than a completed PRD-compliant ticket booking system.
