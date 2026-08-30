# Ticket: Transactional Idempotency

**Type:** Task
**Status:** Pending
**Label:** wayfinder:task

## Question

Implement Phase 4: IdempotencyRecord PENDING claim, canonical hashing, TTL, and same-key race tests.

## Context

Idempotency must be atomic with booking.

## Acceptance Criteria

- UUID v4 validation
- Insert PENDING record first in transaction
- Complete to COMPLETED with cached response
- Handle unique conflicts (same key) with winner-read logic
- Cache 201 and 410 only
- Expiry cleanup
- Same-key race tests

## Dependencies

- 15-multi-hold-booking

## Notes

Refer to IMPLEMENTATION_PLAN Phase 4.