# Ticket Booking System PRD Compliance Remediation Plan

**Version:** 2.1.0

**Date:** 2026-08-17

**Status:** Proposed; implementation not started

**Source:** `docs/PRD_COMPLIANCE_AUDIT.md` and `docs/PRD-ticket-booking-system.md` v1.0.0

## 1. Purpose

This plan replaces the previous completed roadmap. The checked-in implementation is a functional foundation, but the release blockers and high-priority gaps in the compliance audit remain open. No item in this document is complete until its implementation, migration, automated tests, and contract or operational evidence have all passed.

The remediation has four non-negotiable outcomes:

1. Inventory cannot be oversold under concurrent hold, cancellation, expiry, quota-update, or booking operations.
2. A hold can be consumed by at most one order, and one order can atomically consume one or more holds.
3. Concurrent uses of an idempotency key have deterministic behavior and cannot duplicate booking side effects.
4. Runtime routes, response bodies, database constraints, tests, OpenAPI, and operational documentation describe the same system.

### 1.1 Verified Baseline

The following baseline was rechecked on 2026-08-17 and is the starting point for this plan:

| Check | Current result | Planning consequence |
|---|---|---|
| `npm run lint` | Pass | Preserve strict TypeScript checks in every change set. |
| `npm run build` | Pass | Core remediation must not regress the production build. |
| `npm run openapi:lint` | Pass | Spectral validity alone is insufficient; add runtime contract tests. |
| `npm test` | 16 tests pass; two integration suites cannot start without a container runtime | PostgreSQL-backed integration evidence is still unavailable locally. |
| Availability calculation | Counts relation rows rather than `quantity`; does not filter parent order to `SUCCESS` | Release blocker 3.1 remains open. |
| Inventory locking | No `SELECT ... FOR UPDATE`; hold availability reads through global Prisma | Release blocker 3.2 remains open. |
| Hold consumption | Hold is read and updated without a lock or one-consumption constraint | Release blocker 3.3 remains open. |
| Idempotency | Lookup occurs before the booking transaction; no atomic PENDING claim | Release blockers 3.4 and 3.5 remain open. |
| Ticket routes | Router and mount path both include `/events` | Release blocker 3.6 remains open. |
| Runtime controls | No auth limiter, structured logging, readiness, graceful shutdown, or scheduler ownership lock | High-priority operational findings remain open. |

No existing feature is treated as compliant merely because an endpoint or model exists. The relevant phase remains open until its exit evidence passes.

## 2. Required Design Decisions

These decisions resolve the PRD ambiguities identified by the audit. They must be approved before the API and migration changes are merged. The recommendations below are the implementation defaults for this plan.

### D1. Inventory Invariant

**Recommendation:** Use derived availability.

`Ticket.total_quota` is immutable capacity except for an authorized quota update. Current availability is:

```text
total_quota
- SUM(quantity of ACTIVE holds whose expires_at > database NOW())
- SUM(quantity of order details whose parent order is SUCCESS)
```

Creating a hold reserves inventory. Converting that hold to a successful order moves the same quantity from temporary to permanent consumption; it does not decrement `total_quota`. Expiry and cancellation release inventory by changing hold status. This interpretation satisfies FR-3.2 without double-counting the FR-5.3 permanent booking.

### D2. Booking Request

**Recommendation:** Make `hold_ids` a required, non-empty array of unique positive integers. A one-hold booking sends a one-element array. Do not maintain two canonical request shapes.

All holds must belong to the authenticated user. The service locks ticket rows in ascending ID order and then hold rows in ascending ID order. It validates every hold before creating any order side effect.

### D3. Availability Endpoints

**Recommendation:** Both `GET /events/{id}/tickets` and `GET /events/{id}/availability` return quantity-correct availability from the same service. The ticket endpoint includes the normal ticket fields plus `available_quota` and `last_updated`; the dedicated endpoint may retain its collection wrapper if OpenAPI documents it.

### D4. Order Lifecycle

**Recommendation:** Booking creates an immediate `SUCCESS` order because payment processing is out of scope. Remove the unreachable `POST /orders/{id}/confirm` operation from runtime and OpenAPI in the next versioned contract. If external consumers already use it, deprecate it first and return a defined conflict for non-PENDING orders until removal.

### D5. Idempotency Ownership and Expiry

**Recommendation:** `IdempotencyRecord` is the only uniqueness authority. Remove `Order.idempotency_key` or retain it only as a non-unique audit field. A key is unique by `(key, scope)` while its record exists and can be reused after its configured expiry.

The request path inserts a PENDING record as the first statement of the booking transaction. PostgreSQL's unique constraint serializes same-key races. The winner completes the booking and cached response in the same transaction; a loser catches the unique violation and reads the committed winner. Failed business transactions roll back the PENDING claim.

### D6. Event Deletion with History

**Recommendation:** Return `409 Conflict` when an event has holds or order history. Cascade deletion remains valid only for events whose tickets have no inventory history. Booking records must not be silently deleted to satisfy FR-1.5.

## 3. Delivery Rules

- Implement each phase as a reviewable change set and keep migrations forward-only.
- Use PostgreSQL database time (`NOW()`) for hold and idempotency expiry comparisons.
- Use the same Prisma transaction client for every read and write in an inventory operation.
- Use one lock order everywhere: ticket IDs ascending, then hold IDs ascending.
- Map expected Prisma/database conflicts to explicit API errors; do not expose generic 500 responses for normal races.
- Return expected business outcomes from transaction callbacks and translate them to HTTP only after commit. Throw only when the transaction must roll back.
- Do not mark a checkbox complete from mocked tests when the requirement concerns PostgreSQL locking, constraints, migration behavior, or latency.
- Update OpenAPI and tests in the same change as any public route or response change.
- Preserve unrelated worktree changes and avoid compatibility aliases unless an identified consumer requires one.

### 3.1 Definition of Done

An implementation item may be checked only when all applicable conditions are met:

- Production code, Prisma schema, forward migration, OpenAPI, and generated API types agree.
- Focused unit tests pass, and database behavior is covered against PostgreSQL initialized by `prisma migrate deploy`.
- Relevant race tests pass repeatedly, not only once. Use at least 100 iterations for same-ticket, same-hold, and same-key contention suites unless CI runtime evidence justifies another documented count.
- Expected database conflicts return documented 4xx responses and never leak Prisma errors or become generic 500 responses.
- `npm run lint`, `npm run build`, `npm run openapi:lint`, and the applicable test command pass.
- The change set records command output or CI artifact links in its pull request and updates the traceability row when a finding is closed.
- Documentation states observed behavior and limitations; planned controls are not described as already implemented.

### 3.2 Phase Dependencies

```text
Phase 0 (decisions)
  -> Phase 1 (app boundary, migration, real test harness)
      -> Phase 2 (inventory invariant and locking)
          -> Phase 3 (multi-hold booking)
              -> Phase 4 (transactional idempotency)
      -> Phase 5 (runtime/OpenAPI contract alignment)
          -> Phase 6 (security and operations)
              -> Phase 7 (coverage and load evidence)
                  -> Phase 8 (CI, staging, release gate)
```

Phase 5 may begin after the Phase 0 contract decisions, but its contract tests depend on the Phase 1 application factory. Phases 2 through 4 are sequential because each builds on the preceding database invariant and locking protocol.

## 4. Phased Implementation

### Phase 0: Contract and Status Baseline

**Goal:** Resolve product ambiguities and make documentation truthful before implementation diverges further.

- [ ] Approve D1 through D6 and record any deviations in the PRD with a version bump.
- [ ] Change `docs/PRD-ticket-booking-system.md` so FR-5.3 describes derived inventory consumption rather than decrementing `total_quota`.
- [ ] Change FR-5.1 and examples to use `hold_ids`.
- [ ] State that both ticket listing and availability endpoints expose current availability.
- [ ] Remove or formally deprecate the payment-confirmation lifecycle.
- [ ] Mark all PRD acceptance criteria incomplete until their evidence gates pass.
- [ ] Correct `docs/OPERATIONAL_VERIFICATION.md` so it does not claim Pino logs, metrics, or controls that are absent.

**Exit evidence:** Approved PRD v1.1 or an architecture decision record covering D1-D6; no completion claim unsupported by a command, test, or deployment artifact.

### Phase 1: Real Migration and Testable Application Boundary

**Goal:** Make the committed PostgreSQL schema and production application composition the basis of every integration test.

#### Application composition

- [ ] Extract `createApp(dependencies)` from `src/server.ts`; keep listening, cron startup, and signal handling in a thin bootstrap module.
- [ ] Inject the Prisma client into routes/services, or build route factories from an application dependency container. Remove test dependence on a Prisma singleton initialized before `DATABASE_URL` is assigned.
- [ ] Make scheduler startup opt-in so importing the app in tests does not start background jobs.
- [ ] Use the same `createApp` composition in production and Supertest.

#### Integration database

- [ ] Remove hand-written `CREATE TABLE` statements from integration suites.
- [ ] Start PostgreSQL with Testcontainers, assign `DATABASE_URL`, execute `prisma migrate deploy`, generate or load the client, and only then create the application.
- [ ] Add shared setup/teardown helpers that isolate suites without changing production DDL.
- [ ] Add a migration smoke test that initializes an empty PostgreSQL database and performs one representative write/read flow.

#### Schema migration

- [ ] Add `OrderDetail(ticket_id)` index.
- [ ] Replace free-form `IdempotencyRecord.state` with a Prisma/PostgreSQL enum containing `PENDING` and `COMPLETED`.
- [ ] Add database `CHECK` constraints in migration SQL for positive ticket quota, positive hold/detail quantity, nonnegative price/subtotal/total, and valid response status values.
- [ ] Remove the unique constraint from `Order.idempotency_key`; preferably remove the column after any needed data migration.
- [ ] Add an `OrderHold` join model with unique `hold_id` and indexed `order_id`. Migrate existing `Hold.order_id` links, then remove `Hold.order_id`. This permits many holds per order while enforcing at most one order per hold.
- [ ] Define explicit foreign-key deletion behavior for User, Ticket, Hold, OrderDetail, OrderHold, and IdempotencyRecord.
- [ ] Add a migration verification query that checks expected constraints and indexes in `pg_catalog`.

**Exit evidence:** `prisma migrate deploy` succeeds against an empty PostgreSQL 16 container; integration tests use that migration; schema constraint tests reject invalid direct database writes.

### Phase 2: Quantity-Correct, Concurrency-Safe Inventory

**Goal:** Establish one reusable inventory service for availability, hold creation, cancellation, and quota updates.

#### Availability service

- [ ] Change `src/services/availability.ts` to accept a Prisma client or transaction client.
- [ ] Aggregate quantities in PostgreSQL instead of materializing relation rows.
- [ ] Count only `ACTIVE` holds with `expires_at > NOW()` and order details whose parent order is `SUCCESS`.
- [ ] Return the database evaluation timestamp as `last_updated` for all tickets in one response.
- [ ] Do not clamp negative availability to zero. Treat a negative result as an invariant violation, log it, and fail the operation so corruption remains visible.

#### Hold creation and cancellation

- [ ] In `POST /holds`, begin a transaction, lock the ticket with parameterized `SELECT ... FOR UPDATE`, calculate availability through `tx`, validate quantity, and insert the hold through `tx`.
- [ ] Include the current available count in the defined `409 Conflict` response for insufficient quota.
- [ ] In `DELETE /holds/{id}`, lock the ticket and hold, revalidate ownership/status/expiry, and perform a conditional ACTIVE-to-CANCELLED update.
- [ ] Return an expired outcome from the transaction, commit ACTIVE-to-EXPIRED, and then send `410 Gone` outside the transaction callback.
- [ ] Parse hold TTL from validated `env`, not directly from `process.env`.

#### Quota and deletion safety

- [ ] Wrap quota changes in a ticket-row-locking transaction.
- [ ] Calculate active plus successful allocated quantity and reject `total_quota` below that amount with `409 Conflict`.
- [ ] Define the response when an event or ticket has history and convert foreign-key failures to the approved conflict contract.

#### Inventory tests

- [ ] Test quantities greater than one for active holds and successful orders.
- [ ] Prove PENDING, CANCELLED, and EXPIRED orders do not consume availability.
- [ ] Prove expired ACTIVE rows do not consume availability before the scheduler updates their status.
- [ ] Run repeated concurrent hold attempts whose requested total exceeds quota; assert successful held quantity, not request count, never exceeds capacity.
- [ ] Test hold cancellation racing with booking and hold expiry racing with booking.
- [ ] Test quota reduction racing with hold creation.

**Exit evidence:** Repeated PostgreSQL-backed contention tests preserve `active hold quantity + successful order quantity <= total_quota` for every ticket.

### Phase 3: Atomic Multi-Hold Booking

**Goal:** Consume one or more holds exactly once in one transaction.

- [ ] Validate `{ hold_ids: number[] }` as non-empty, unique, and bounded to a documented maximum size.
- [ ] Resolve hold IDs to ticket IDs, then lock ticket rows ascending and hold rows ascending; re-read all locked records before validation.
- [ ] Verify every hold exists, belongs to the user, is ACTIVE, and is unexpired using database time.
- [ ] If any hold is expired, persist its EXPIRED transition and return a deterministic expired outcome from the transaction; after commit, send `410 Gone` and create no order.
- [ ] Aggregate holds for the same ticket into one `OrderDetail` quantity and calculate Decimal subtotal/total from locked ticket prices.
- [ ] Create the SUCCESS order, details, `OrderHold` links, and conditional hold status updates in one transaction.
- [ ] Require the conditional ACTIVE-to-CONSUMED update count to equal the requested hold count; otherwise roll back with `409 Conflict`.
- [ ] Remove or deprecate `/orders/{id}/confirm` according to D4.
- [ ] Return the exact order representation selected in OpenAPI; do not wrap it in an undocumented `{ order, hold_id }` object.

#### Booking tests

- [ ] Book one hold and multiple holds, including multiple holds for the same ticket.
- [ ] Attempt the same hold concurrently with different idempotency keys; assert exactly one order and one `OrderHold` link.
- [ ] Verify mixed valid/expired/foreign-user hold sets create no partial order.
- [ ] Inject failures after order creation, detail creation, link creation, and status update; assert complete rollback.
- [ ] Verify deterministic locking with reversed input order does not deadlock.

**Exit evidence:** Repeated same-hold contention creates exactly one successful order, and multi-hold failure leaves every valid hold unchanged.

### Phase 4: Transactional Idempotency

**Goal:** Coordinate retries before booking side effects and support configured key expiry.

- [ ] Validate `Idempotency-Key` as UUID v4 in Zod and OpenAPI.
- [ ] Canonicalize the validated `hold_ids` array before hashing so semantically identical requests have the same hash.
- [ ] Use `env.IDEMPOTENCY_TTL_SECONDS` and database time to calculate expiry.
- [ ] At transaction start, delete an expired record for the same key/scope and insert a PENDING claim containing owner, scope, hash, and expiry.
- [ ] Complete the booking and update that claim to COMPLETED with the exact status code and response body before commit.
- [ ] Catch a `(key, scope)` unique conflict outside the aborted claim transaction, read the committed winning record, and apply these rules:
  - Matching owner/hash and COMPLETED: return the cached status and body.
  - Different owner or hash: return `409 Conflict`.
  - Matching but PENDING: return a documented retryable response such as `409` with `Retry-After`; this should be limited to legacy/recovery states when claim and work share one transaction.
  - Expired: remove/reclaim it safely and process as new.
- [ ] Define which deterministic non-2xx results are cached. At minimum, cache a committed expired-hold `410` so retries remain stable.
- [ ] Ensure unexpected transaction failure rolls back the PENDING claim and permits retry.
- [ ] Update cleanup so it deletes only expired records and cannot interfere with an uncommitted booking transaction.

#### Idempotency tests

- [ ] Run simultaneous same-key/same-payload requests; assert identical responses and one order.
- [ ] Run simultaneous same-key/different-payload and different-owner requests; assert one winner and deterministic conflicts.
- [ ] Reuse a key after expiry; assert a new operation succeeds without an order-level uniqueness error.
- [ ] Retry after an injected rollback; assert no stranded claim and exactly one eventual order.

**Exit evidence:** All retry race tests pass repeatedly against PostgreSQL with one booking side effect per unexpired key.

### Phase 5: Runtime and OpenAPI Contract Alignment

**Goal:** Make every documented operation reachable at the documented path with the documented body and status.

- [ ] Mount `ticketsRouter` once so runtime paths are `/events/{eventId}/tickets` and `/events/{eventId}/tickets/{ticketId}`.
- [ ] Put route registration in `createApp` so production and tests cannot drift.
- [ ] Return `available_quota` and `last_updated` from ticket listing through the shared availability service.
- [ ] Update order request/response schemas for `hold_ids`, UUID v4 idempotency, multi-detail orders, and the selected bare response shape.
- [ ] Add a `GoneError` or equivalent 410 mapping and document all inventory/idempotency conflict bodies.
- [ ] Implement the approved event-deletion conflict behavior.
- [ ] Generate API types from the final OpenAPI document and fail CI on generated diff.
- [ ] Add contract tests for every OpenAPI method/path, including authorization and representative response-schema validation.

**Exit evidence:** Spectral passes; generated types are current; Supertest reaches the literal OpenAPI paths and validates status/body contracts.

### Phase 6: Security, Observability, and Runtime Operations

**Goal:** Add the production controls claimed by the PRD.

#### Security

- [ ] Mount a login limiter configured for at most five attempts per minute per IP. Use separate, documented limits for register and refresh if needed.
- [ ] Validate numeric environment values and safe ranges during startup instead of parsing unchecked strings at use sites.
- [ ] Permit predictable seed users only when `NODE_ENV=development` and an explicit seed flag is enabled; otherwise require credentials from environment or generate one-time secrets without logging passwords in shared environments.
- [ ] Add tests for limiter behavior, CORS production allowlist, malformed input, authorization, and secret redaction.

#### Observability

- [ ] Add Pino request logging with generated/propagated request IDs and child logger context.
- [ ] Replace `console.*` calls with structured logs that exclude credentials, tokens, idempotency payloads, and personal data.
- [ ] Add counters/histograms for hold outcomes, booking outcomes, expiry count, idempotency outcomes, request duration, and database errors.
- [ ] Expose `/health` for liveness and `/ready` for a bounded database readiness query. Protect or constrain the metrics endpoint as appropriate.

#### Process and scheduler

- [ ] Retain the cron schedule at 30 seconds but run each expiry/cleanup cycle under a PostgreSQL transaction-level advisory lock so only one instance owns a cycle.
- [ ] Log scheduler duration, release count, cleanup count, lock miss, and errors.
- [ ] Handle SIGTERM/SIGINT: stop accepting traffic, stop cron scheduling, drain the HTTP server, disconnect Prisma, and exit within a configured timeout.
- [ ] Add startup failure and graceful-shutdown tests.

#### Deployment

- [ ] Add a production multi-stage Dockerfile with a non-root runtime user and health check.
- [ ] Add a local service definition for API plus PostgreSQL and document required production environment variables.
- [ ] Document migration-before-start, rollback, backup/restore, scheduler ownership, and readiness semantics.

**Exit evidence:** Container smoke test applies migrations, starts the compiled app, passes liveness/readiness, emits structured correlated logs/metrics, and shuts down cleanly.

### Phase 7: Verification, Coverage, and Load

**Goal:** Turn the core guarantees into repeatable release evidence.

- [ ] Split unit, integration, concurrency, and load commands so failures are attributable.
- [ ] Keep mocks for pure unit tests only; do not count mocked availability as load or concurrency proof.
- [ ] Raise line, statement, function, and branch thresholds to at least 81% and include the production bootstrap in measured code.
- [ ] Cover all section 11 PRD error cases and every concurrency scenario listed in audit finding 5.3.
- [ ] Extend k6 to availability, hold creation, and booking using realistic authenticated users and ticket contention.
- [ ] Run a 1,000-active-user-per-event profile against a deployed PostgreSQL-backed environment, measure server-side and client-side P95, and assert no oversell after the run.
- [ ] Store the k6 configuration, environment shape, database sizing, result summary, and commit SHA as release artifacts.

**Exit evidence:** Coverage is greater than 80%; all integration/concurrency suites pass; availability and booking P95 are below 300 ms under the documented 1,000-user test with zero invariant violations.

### Phase 8: CI, Staging, and Release Gate

**Goal:** Make compliance continuously enforceable.

- [ ] Assign `DATABASE_URL` to Prisma generate/validate/migrate steps where required.
- [ ] Run `prisma migrate deploy` against the CI PostgreSQL service before integration tests.
- [ ] Run lint/typecheck, build, unit tests, integration tests, concurrency tests, coverage, OpenAPI lint, generated-contract check, and migration smoke test.
- [ ] Start `dist/server.js` in CI and execute liveness/readiness and representative API smoke tests.
- [ ] Build and scan the container artifact.
- [ ] Deploy the immutable artifact to staging, apply migrations as a separate release step, and run smoke/concurrency checks there.
- [ ] Run k6 in a scheduled or release workflow rather than on every small pull request.
- [ ] Upload coverage, contract, migration, container, and load artifacts.
- [ ] Update `docs/PRD_COMPLIANCE_AUDIT.md` with a dated re-audit; do not rewrite the original evidence without retaining history.

**Release gate:** Production inventory remains blocked until every Phase 8 check is green and the re-audit has no Critical or High unresolved finding.

## 5. Audit Traceability

| Audit finding | Remediation phase | Required proof |
|---|---:|---|
| 3.1 Quantity-incorrect availability | 2 | Quantity/status aggregation tests |
| 3.2 Unsafe hold creation | 2 | Repeated contention invariant test |
| 3.3 One hold creates multiple orders | 1, 3 | Unique OrderHold plus same-hold race test |
| 3.4 Uncoordinated idempotent retries | 4 | Same-key concurrency tests |
| 3.5 Expiry conflicts with order uniqueness | 1, 4 | Post-expiry key reuse test |
| 3.6 Incorrect ticket paths | 5 | Literal path contract tests |
| 4.1 Ticket listing omits availability | 2, 5 | Response schema integration test |
| 4.2 Single-hold booking | 0, 3 | Multi-hold atomicity tests |
| 4.3 Key is not UUID v4 | 4, 5 | Validation and OpenAPI tests |
| 4.4 Configured TTL ignored | 4 | Configured-expiry test |
| 4.5 Expired hold status/rollback | 2, 3, 5 | Persisted expiry plus 410 test |
| 4.6 Unsafe quota reduction | 2 | Allocation and race tests |
| 4.7 Missing database constraints | 1 | Direct invalid-write tests |
| 4.8 Order/OpenAPI response mismatch | 0, 3, 5 | Response contract test |
| 4.9 Event deletion failure | 0, 2, 5 | History conflict test |
| 4.10 Missing auth rate limiting | 6 | Five-attempt limiter test |
| 4.11 Predictable seed credentials | 6 | Production seed refusal test |
| 4.12 Missing observability | 6 | Log/request-ID/metrics tests |
| 4.13 Incomplete runtime operations | 6, 8 | Container, readiness, shutdown, staging evidence |
| 4.14 Unscalable availability query | 1, 2, 7 | Index verification and query/load results |
| 5.1 Tests bypass migration | 1 | Empty-database migration test |
| 5.2 Unreliable DB initialization | 1 | Dependency-injected app integration test |
| 5.3 Missing concurrency cases | 2, 3, 4, 7 | Repeated PostgreSQL race suites |
| 5.4 Mocked load verification | 7 | Deployed k6 report |
| 5.5 Coverage below literal target | 7 | CI coverage artifact >80% |
| 5.6 CI not deployment-ready | 8 | Green release workflow |
| 5.7 Overstated status | 0, 8 | Evidence-linked documentation and re-audit |

## 6. Recommended Change-Set Order

1. **PR 1:** D1-D6 decisions, truthful documentation, app factory, and injected Prisma dependency.
2. **PR 2:** Forward migration, `OrderHold`, constraints/indexes, and migration-backed test harness.
3. **PR 3:** Aggregated availability, ticket locks, hold/cancel/quota safety, and inventory contention tests.
4. **PR 4:** Multi-hold booking, one-consumption guarantee, expired-hold handling, and rollback tests.
5. **PR 5:** Transactional idempotency, expiry semantics, and retry race tests.
6. **PR 6:** Router/OpenAPI alignment, response contracts, event deletion, and contract tests.
7. **PR 7:** Rate limiting, seed hardening, Pino, metrics, readiness, advisory-locked scheduler, and graceful shutdown.
8. **PR 8:** Container, CI/staging workflow, coverage, k6, operational documentation, and compliance re-audit.

PRs 3 through 5 must not be merged without the migration-backed concurrency tests relevant to that PR. PR 8 must not relabel the system production-ready until the release gate is satisfied.

### 6.1 Delivery Estimate and Ownership

The estimates below are engineering ranges, not release commitments. They assume one primary backend engineer, review availability, and a working Docker or compatible container runtime.

| Change set | Primary owner | Estimate | Depends on | Merge gate |
|---|---|---:|---|---|
| PR 1: decisions and app boundary | Product + backend | 2-3 days | None | D1-D6 approved; production and tests use one app factory. |
| PR 2: migration and test harness | Backend/data | 3-5 days | PR 1 | Empty-database migration and direct constraint tests pass. |
| PR 3: inventory safety | Backend/data | 4-6 days | PR 2 | Repeated hold, cancel, expiry, and quota contention tests preserve capacity. |
| PR 4: multi-hold booking | Backend | 4-6 days | PR 3 | Same-hold race creates exactly one order; rollback tests pass. |
| PR 5: idempotency | Backend | 3-5 days | PR 4 | Same-key races and post-expiry reuse are deterministic. |
| PR 6: API contract | Backend/API | 2-4 days | PR 1; preferably PR 5 | Every documented path and representative response validates at runtime. |
| PR 7: runtime controls | Backend/platform | 4-6 days | PR 2, PR 6 | Security, readiness, scheduler ownership, logging, and shutdown tests pass. |
| PR 8: release evidence | Platform/QA | 4-7 days plus staging observation | PR 3-7 | CI, container smoke, staging, coverage, and load artifacts satisfy release gates. |

Expected elapsed engineering effort is approximately 26-42 working days. Parallel work is appropriate for OpenAPI contract tooling and deployment scaffolding after PR 1, but inventory, booking, and idempotency changes must retain their dependency order.

### 6.2 Work Priorities

| Priority | Scope | Release policy |
|---|---|---|
| P0 | Phases 0-5: migration-backed tests, inventory locking, one-time hold consumption, idempotency, and route contracts | Blocks any use with real ticket inventory. |
| P1 | Phase 6 and CI portions of Phase 8: security, readiness, shutdown, scheduler ownership, deployment smoke | Blocks production deployment. |
| P2 | Phase 7 load/coverage completion and remaining operational evidence | Blocks PRD compliance and performance claims. |

## 7. Final Acceptance Checklist

- [ ] Availability uses quantities and only active/unexpired holds plus SUCCESS orders.
- [ ] Concurrent holds never reserve more than `total_quota`.
- [ ] One hold is linked to at most one order under concurrent booking attempts.
- [ ] Multiple holds convert atomically into one order.
- [ ] Same-key retries are deterministic; different payloads conflict; expired keys are reusable.
- [ ] Expired holds persist as EXPIRED and return 410 when booked.
- [ ] Quota cannot be lowered below allocated inventory.
- [ ] Runtime routes and response bodies validate against OpenAPI.
- [ ] The real migration initializes all integration-test databases.
- [ ] Security, observability, readiness, shutdown, and scheduler ownership controls are executable.
- [ ] Coverage exceeds 80% and all critical race tests pass in CI.
- [ ] PostgreSQL-backed load evidence meets P95 and 1,000-user targets with zero oversell.
- [ ] A dated re-audit reports no unresolved Critical or High finding.

Until this checklist passes, describe the repository as a functional foundation under remediation, not a PRD-compliant production ticket inventory system.
