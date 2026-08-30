# Ticket: Implement Booking with Idempotency Key

**Type:** Task
**Status:** Done
**Label:** wayfinder:task

## Question

How do we implement the booking confirmation flow with UUID v4 idempotency key generation, session-scoped key caching, and proper handling of all 4xx/5xx outcomes (201, 410, 409, 503)?

## Context

PRD FR-6.1 mandates that `POST /orders` requires an `Idempotency-Key` header (UUID v4). The frontend must generate, cache, and reuse this key correctly across retries to prevent duplicate bookings.

## Acceptance Criteria

- `src/modules/orders/` with `components/`, `hooks/`, `pages/orders/`, `services/`.
- `src/app/(authenticated)/checkout/page.tsx` — booking confirmation page.
- `useCreateOrder` mutation that generates `crypto.randomUUID()` per booking intent.
- Session-scoped key cache (sessionStorage) keyed by booking intent hash.
- Key reuse on network failure, 5xx, and 503 retry-exhausted.
- Key cleared on 201 success or 410 HOLD_EXPIRED.
- Error mapping:
  - `201 ORDER_CREATED` → success, redirect to order detail.
  - `410 HOLD_EXPIRED` → toast + clear intent, redirect to event.
  - `409 IDEMPOTENCY_IN_PROGRESS` → silent retry with backoff.
  - `409 IDEMPOTENCY_KEY_CONFLICT` → hard error, force fresh key.
  - `503 DB_TRANSACTION_RETRY_EXHAUSTED` → exponential backoff retry, same key.
- NO optimistic updates for booking (idempotency + 410 cache make rollback unsafe).

## Dependencies

- **Blocked by:** 01-bootstrap, 02-codegen, 03-auth, 05-holds.

## Notes

- Validate UUID v4 shape before sending.
- Refer to PRD FR-6.1 through FR-6.6 for full idempotency contract.
